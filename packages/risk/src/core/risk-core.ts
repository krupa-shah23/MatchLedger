import type { AccountSnapshot, RiskCommand, RiskConfig, RiskEvent, RiskState, StampedRiskCommand } from "@matchledger/common";

import { InvalidRiskStateError, RiskInvariantError } from "./errors.js";
import { computeMarketLimit, resolveReference } from "./reference.js";
import type { Account, AccountView, Reservation, RiskSnapshot } from "./state.js";

export class RiskCore {
  public readonly decisions = new Set<string>();
  public readonly seenRequestIds = new Set<string>();
  public readonly haltedSymbols = new Set<string>();
  public readonly accounts = new Map<string, Account>();
  public readonly reservations = new Map<string, Reservation>();
  public readonly events: RiskEvent[] = [];
  public readonly commandLog: RiskCommand[] = [];
  public readonly adjustmentIds = new Set<string>();

  public constructor(private readonly config: RiskConfig = { instruments: new Map() }) {}

  public static restore(config: RiskConfig, state: RiskState, partition?: number): RiskCore {
    void partition;
    if (state.version !== 1) throw new InvalidRiskStateError("VERSION", `invalid version ${state.version}`);
    const configSymbols = new Set(config.instruments.keys());
    const stateSymbols = new Set(state.instruments.map(i => i.symbol));
    if (configSymbols.size !== stateSymbols.size || ![...configSymbols].every(s => stateSymbols.has(s))) {
      throw new InvalidRiskStateError("CONFIG_MISMATCH", "symbols");
    }
    for (const res of state.reservations) {
      if (!state.decidedOrders.includes(res.orderId)) throw new InvalidRiskStateError("RESERVATION_NOT_DECIDED", res.orderId);
    }
    const allOrderIds = new Set<string>();
    for (const res of state.reservations) {
      if (allOrderIds.has(res.orderId)) throw new InvalidRiskStateError("DUPLICATE_RESERVATION", res.orderId);
      allOrderIds.add(res.orderId);
    }
    const accountIds = new Set(state.accounts.map(a => a.accountId));
    for (const res of state.reservations) {
      if (!accountIds.has(res.accountId)) throw new InvalidRiskStateError("UNKNOWN_ACCOUNT", res.accountId);
      if (res.qtyRemaining <= 0n) throw new InvalidRiskStateError("NEGATIVE", res.orderId);
      if (res.side === "BUY" && res.amountRemaining !== res.priceCap * res.qtyRemaining) throw new InvalidRiskStateError("AMOUNT_MISMATCH", res.orderId);
      if (res.side === "SELL" && res.amountRemaining !== res.qtyRemaining) throw new InvalidRiskStateError("AMOUNT_MISMATCH", res.orderId);
    }
    for (const acc of state.accounts) {
      if (acc.cash < 0n || acc.heldCash < 0n || acc.heldCash > acc.cash) throw new InvalidRiskStateError("NEGATIVE", acc.accountId);
      for (const pos of acc.positions) {
        if (pos.quantity < 0n || pos.heldShares < 0n || pos.heldShares > pos.quantity) throw new InvalidRiskStateError("OVER_HELD", `${acc.accountId}/${pos.symbol}`);
      }
    }
    const buySum = new Map<string, bigint>();
    const sellSum = new Map<string, bigint>();
    for (const res of state.reservations) {
      if (res.side === "BUY") {
        buySum.set(res.accountId, (buySum.get(res.accountId) || 0n) + res.amountRemaining);
      } else {
        const key = `${res.accountId}/${res.symbol}`;
        sellSum.set(key, (sellSum.get(key) || 0n) + res.qtyRemaining);
      }
    }
    const heldSharesByKey = new Map<string, bigint>();
    for (const acc of state.accounts) {
      if ((buySum.get(acc.accountId) || 0n) !== acc.heldCash) throw new InvalidRiskStateError("HELD_MISMATCH", acc.accountId);
      for (const pos of acc.positions) {
        heldSharesByKey.set(`${acc.accountId}/${pos.symbol}`, pos.heldShares);
      }
    }
    const allShareKeys = new Set([...sellSum.keys(), ...heldSharesByKey.keys()]);
    for (const key of allShareKeys) {
      if ((sellSum.get(key) || 0n) !== (heldSharesByKey.get(key) || 0n)) throw new InvalidRiskStateError("HELD_MISMATCH", key);
    }
    const core = new RiskCore(config);
    for (const o of state.decidedOrders) core.decisions.add(o);
    for (const r of state.seenRequestIds) core.seenRequestIds.add(r);
    for (const a of state.seenAdjustmentIds) core.adjustmentIds.add(a);
    for (const s of state.haltedSymbols) core.haltedSymbols.add(s);
    for (const acc of state.accounts) {
      core.accounts.set(acc.accountId, { cash: acc.cash, heldCash: acc.heldCash, positions: new Map(acc.positions.map(p => [p.symbol, { quantity: p.quantity, heldShares: p.heldShares }])) });
    }
    for (const res of state.reservations) {
      core.reservations.set(res.orderId, { ...res, appliedTradeIds: new Set(res.appliedTradeIds) });
    }
    const issues = core.checkInvariants();
    if (issues.length > 0) throw new InvalidRiskStateError("INVARIANT", issues.join(";"));
    return core;
  }

  public exportState(): RiskState {
    const instrumentEntries = [...this.config.instruments.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
    const accounts = [...this.accounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([accountId, account]) => ({
        accountId,
        cash: account.cash,
        heldCash: account.heldCash,
        positions: [...account.positions.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([symbol, position]) => ({ symbol, quantity: position.quantity, heldShares: position.heldShares })),
      }));
    const reservations = [...this.reservations.values()]
      .sort((left, right) => left.placedSeq - right.placedSeq || left.orderId.localeCompare(right.orderId))
      .map((reservation) => ({
        orderId: reservation.orderId,
        accountId: reservation.accountId,
        symbol: reservation.symbol,
        side: reservation.side,
        priceCap: reservation.priceCap,
        qtyRemaining: reservation.qtyRemaining,
        amountRemaining: reservation.amountRemaining,
        state: reservation.state,
        placedTs: reservation.placedTs,
        placedSeq: reservation.placedSeq,
        appliedTradeIds: [...reservation.appliedTradeIds].sort((left, right) => left.localeCompare(right)),
      }));

    return {
      version: 1,
      partition: 0,
      instruments: instrumentEntries.map((instrument) => ({
        symbol: instrument.symbol,
        tickSize: instrument.tickSize,
        maxPrice: instrument.maxPrice,
        protectionBandBps: instrument.protectionBandBps,
        maxBandBps: instrument.maxBandBps,
        referencePriceTicks: instrument.referencePriceTicks,
        maxReferenceAgeMs: instrument.maxReferenceAgeMs,
      })),
      accounts,
      reservations,
      decidedOrders: [...this.decisions].sort((left, right) => left.localeCompare(right)),
      seenRequestIds: [...this.seenRequestIds].sort((left, right) => left.localeCompare(right)),
      seenAdjustmentIds: [...this.adjustmentIds].sort((left, right) => left.localeCompare(right)),
      haltedSymbols: [...this.haltedSymbols].sort((left, right) => left.localeCompare(right)),
    };
  }

  public apply(command: StampedRiskCommand): readonly RiskEvent[] {
    const events: RiskEvent[] = [];
    const current = command.command;
    this.commandLog.push(current);

    switch (current.type) {
      case "OpenAccount": {
        const account = this.ensureAccount(current.accountId);
        const opened: RiskEvent = { type: "AccountOpened", accountId: current.accountId };
        events.push(opened);
        this.events.push(opened);
        account.cash = account.cash;
        break;
      }
      case "Deposit": {
        if (this.seenRequestIds.has(current.requestId)) {
          events.push({ type: "DuplicateIgnored", kind: "DEPOSIT", id: current.requestId });
          this.events.push(...events);
          return events;
        }
        const account = this.getAccount(current.accountId);
        if (account === undefined) {
          events.push({ type: "DuplicateIgnored", kind: "DEPOSIT", id: current.requestId });
          this.events.push(...events);
          return events;
        }
        // Handle CASH vs SHARES deposits
        if (current.asset === "CASH") {
          account.cash += current.amount;
        } else if (current.asset.startsWith("SHARES:")) {
          const symbol = current.asset.substring(7);
          const position = this.getPosition(account, symbol);
          position.quantity += current.amount;
        }
        this.seenRequestIds.add(current.requestId);
        const event: RiskEvent = { type: "FundsDeposited", accountId: current.accountId, asset: current.asset, amount: current.amount, requestId: current.requestId };
        events.push(event);
        this.events.push(event);
        break;
      }
      case "HaltSymbol": {
        this.haltedSymbols.add(current.symbol);
        const event: RiskEvent = { type: "SymbolStatusChanged", symbol: current.symbol, status: "HALTED", reason: current.reason };
        events.push(event);
        this.events.push(event);
        break;
      }
      case "ResumeSymbol": {
        this.haltedSymbols.delete(current.symbol);
        const event: RiskEvent = { type: "SymbolStatusChanged", symbol: current.symbol, status: "ACTIVE" };
        events.push(event);
        this.events.push(event);
        break;
      }
      case "SubmitOrder": {
        const result = this.onSubmitOrder(command);
        this.events.push(...result);
        return result;
      }
      case "OrderAcked": {
        const result = this.onAck(command);
        this.events.push(...result);
        return result;
      }
      case "FillApplied": {
        const result = this.onFill(command);
        this.events.push(...result);
        return result;
      }
      case "OrderClosed": {
        const result = this.onClose(command);
        this.events.push(...result);
        return result;
      }
      case "OrderRejectedByMatcher": {
        const result = this.onClose(command);
        this.events.push(...result);
        return result;
      }
      case "ApplyAdjustment": {
        const result = this.applyAdjustment(command);
        this.events.push(...result);
        return result;
      }
      case "SweepProbe": {
        const candidates = [...this.reservations.values()]
          .filter((reservation) => reservation.state === "PENDING_ACK")
          .filter((reservation) => command.ts - reservation.placedTs >= current.olderThanMs)
          .map((reservation) => ({ orderId: reservation.orderId, symbol: reservation.symbol }));
        const event: RiskEvent = { type: "SweepCandidates", candidates };
        events.push(event);
        this.events.push(event);
        break;
      }
      case "ReleaseUnreached": {
        const reservation = this.reservations.get(current.orderId);
        if (reservation === undefined) {
          events.push({ type: "UnknownOrderIgnored", orderId: current.orderId, command: "ReleaseUnreached" });
          this.events.push(...events);
          return events;
        }
        const released = this.releaseReservation(reservation, "NEVER_REACHED_MATCHER");
        events.push(...released);
        this.events.push(...released);
        break;
      }
      default: {
        break;
      }
    }

    return events;
  }

  public onSubmitOrder(command: StampedRiskCommand): readonly RiskEvent[] {
    const current = command.command;
    if (current.type !== "SubmitOrder") {
      return [];
    }
    // Decision order per section 4.5:
    // 1. Dedupe
    if (this.decisions.has(current.orderId)) {
      const event: RiskEvent = { type: "DuplicateIgnored", kind: "ORDER", id: current.orderId };
      return [event];
    }

    // 2. Account exists
    const account = this.getAccount(current.accountId);
    if (account === undefined) {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "UNKNOWN_ACCOUNT" }];
    }

    // 3. Symbol exists
    const instrument = this.config.instruments.get(current.symbol);
    if (instrument === undefined) {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "UNKNOWN_SYMBOL" }];
    }

    // 3a. Symbol is halted; reject before reservation is ever created.
    if (this.haltedSymbols.has(current.symbol)) {
      const snapshot = this.accountSnapshot(current.accountId, current.symbol);
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "SYMBOL_HALTED", snapshot }];
    }

    // 4. Order validity (kind, timeInForce, price)
    if (current.kind === "LIMIT" && current.price === undefined) {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INVALID_ORDER" }];
    }
    if (current.kind === "MARKET" && current.price !== undefined) {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INVALID_ORDER" }];
    }
    if (current.kind === "MARKET" && current.timeInForce !== "IOC") {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INVALID_ORDER" }];
    }
    if (current.quantity <= 0n) {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INVALID_ORDER" }];
    }
    if (current.kind === "LIMIT" && current.price !== undefined && current.price <= 0n) {
      this.decisions.add(current.orderId);
      return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INVALID_ORDER" }];
    }

    // 5. Resolve reference price for market orders
    let reference;
    if (current.kind === "MARKET") {
      reference = resolveReference(current.market, command.ts, instrument);
      if (reference === undefined) {
        this.decisions.add(current.orderId);
        return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "NO_REFERENCE_PRICE" }];
      }
    }

    // Compute price cap/floor
    const priceCap = current.kind === "MARKET" ? computeMarketLimit(current.side, reference!.price, instrument) : current.price!;

    // Take snapshot BEFORE any reservation (validation decision point)
    const snapshot = this.accountSnapshot(current.accountId, current.symbol);

    // 6. Check balance/position BEFORE mutation
    if (current.side === "BUY") {
      // Validate overflow
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        priceCap * current.quantity;
      } catch {
        this.decisions.add(current.orderId);
        return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INVALID_ORDER" }];
      }
      const needed = priceCap * current.quantity;
      const available = account.cash - account.heldCash;
      if (available < needed) {
        this.decisions.add(current.orderId);
        return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INSUFFICIENT_BALANCE", required: needed, snapshot }];
      }
    } else {
      // SELL: no short selling
      const position = this.getPosition(account, current.symbol);
      const availableShares = position.quantity - position.heldShares;
      if (availableShares < current.quantity) {
        this.decisions.add(current.orderId);
        return [{ type: "OrderRejected", orderId: current.orderId, accountId: current.accountId, reason: "INSUFFICIENT_POSITION", required: current.quantity, snapshot }];
      }
    }

    // Now mutate: place reservation
    const reservation: Reservation = {
      orderId: current.orderId,
      accountId: current.accountId,
      symbol: current.symbol,
      side: current.side,
      priceCap,
      qtyRemaining: current.quantity,
      amountRemaining: current.side === "BUY" ? priceCap * current.quantity : current.quantity,
      state: "PENDING_ACK",
      placedTs: command.ts,
      placedSeq: command.seq,
      appliedTradeIds: new Set<string>(),
    };

    this.reservations.set(current.orderId, reservation);
    this.decisions.add(current.orderId);

    if (current.side === "BUY") {
      account.heldCash += reservation.amountRemaining;
    } else {
      const pin = this.getPosition(account, current.symbol);
      pin.heldShares += current.quantity;
    }

    // Emit events
    const accepted: RiskEvent = {
      type: "OrderAccepted",
      orderId: current.orderId,
      accountId: current.accountId,
      symbol: current.symbol,
      side: current.side,
      timeInForce: current.kind === "MARKET" ? "IOC" : current.timeInForce,
      price: priceCap,
      quantity: current.quantity,
      referencePrice: reference?.price,
      referenceSource: reference?.source,
    };
    const placed: RiskEvent = {
      type: "ReservationPlaced",
      orderId: current.orderId,
      accountId: current.accountId,
      symbol: current.symbol,
      side: current.side,
      asset: current.side === "BUY" ? "CASH" : `SHARES:${current.symbol}`,
      amount: reservation.amountRemaining,
      quantity: current.quantity,
      priceCap,
    };
    return [placed, accepted];
  }

  public onFill(command: StampedRiskCommand): readonly RiskEvent[] {
    const current = command.command;
    if (current.type !== "FillApplied") {
      return [];
    }
    const reservation = this.reservations.get(current.orderId);
    if (reservation === undefined) {
      return [{ type: "UnknownOrderIgnored", orderId: current.orderId, command: "FillApplied" }];
    }
    if (reservation.appliedTradeIds.has(current.tradeId)) {
      return [{ type: "DuplicateIgnored", kind: "FILL", id: current.tradeId }];
    }

    // Validate BEFORE mutation (section 4.5)
    if (current.quantity <= 0n) {
      throw new RiskInvariantError("INTERNAL", "fill quantity must be positive");
    }
    if (current.quantity > reservation.qtyRemaining) {
      throw new RiskInvariantError("FILL_EXCEEDS_REMAINING", `fill ${current.quantity} exceeds remaining ${reservation.qtyRemaining}`);
    }
    if (reservation.side === "BUY" && current.price > reservation.priceCap) {
      throw new RiskInvariantError("PRICE_ABOVE_CAP", "fill price exceeds BUY reservation cap");
    }
    if (reservation.side === "SELL" && current.price < reservation.priceCap) {
      throw new RiskInvariantError("PRICE_BELOW_FLOOR", "fill price violates SELL reservation floor");
    }

    const account = this.getAccount(reservation.accountId);
    if (account === undefined) {
      throw new RiskInvariantError("INTERNAL", `missing account for ${reservation.accountId}`);
    }

    // Conversion arithmetic (section 4.5):
    // consumed = cap x f
    // cost = p x f
    // improvement = consumed - cost
    const consumed = reservation.priceCap * current.quantity;
    const cost = current.price * current.quantity;
    const improvement = consumed - cost;

    // Mark as applied for dedupe
    reservation.appliedTradeIds.add(current.tradeId);

    // Mutate state per section 4.5
    if (reservation.side === "BUY") {
      // heldCash -= consumed ; cash -= cost ; position += f
      account.heldCash -= consumed;
      account.cash -= cost;
      const position = this.getPosition(account, reservation.symbol);
      position.quantity += current.quantity;
    } else {
      // SELL: heldShares -= f ; position -= f ; cash += p x f
      account.cash += cost;
      const position = this.getPosition(account, reservation.symbol);
      position.quantity -= current.quantity;
      position.heldShares -= current.quantity;
    }

    // Update reservation
    reservation.qtyRemaining -= current.quantity;
    reservation.amountRemaining -= consumed;
    reservation.state = "LIVE";

    // Emit event
    const converted: RiskEvent = {
      type: "ReservationConverted",
      orderId: current.orderId,
      accountId: reservation.accountId,
      tradeId: current.tradeId,
      consumed,
      cost,
      improvement,
    };

    // Close reservation if fully filled
    if (reservation.qtyRemaining === 0n) {
      this.reservations.delete(current.orderId);
    }

    return [converted];
  }

  public onClose(command: StampedRiskCommand): readonly RiskEvent[] {
    const current = command.command;
    if (current.type !== "OrderClosed" && current.type !== "OrderRejectedByMatcher") {
      return [];
    }

    const reservation = this.reservations.get(current.orderId);
    if (reservation === undefined) {
      return [{ type: "UnknownOrderIgnored", orderId: current.orderId, command: current.type }];
    }

    // Validate BEFORE mutation (section 4.5)
    if (current.type === "OrderClosed" && current.remaining !== reservation.qtyRemaining) {
      throw new RiskInvariantError("CLOSE_REMAINING_MISMATCH", `OrderClosed remaining mismatch for ${current.orderId}`);
    }

    // Release only the remaining reserved amount (section 4.5)
    const reason = current.type === "OrderRejectedByMatcher" ? "MATCHER_REJECTED" : "CANCELLED";
    const release = this.releaseReservation(reservation, reason);
    return release;
  }

  public onAck(command: StampedRiskCommand): readonly RiskEvent[] {
    const current = command.command;
    if (current.type !== "OrderAcked") {
      return [];
    }
    const reservation = this.reservations.get(current.orderId);
    if (reservation === undefined) {
      return [{ type: "UnknownOrderIgnored", orderId: current.orderId, command: "OrderAcked" }];
    }
    reservation.state = "LIVE";
    return [];
  }

  public view(accountId: string): AccountView {
    const account = this.accounts.get(accountId);
    if (account === undefined) {
      return {
        cash: 0n,
        heldCash: 0n,
        availableCash: 0n,
        positions: new Map(),
        heldBySymbol: [],
      };
    }

    const positions = new Map([...account.positions.entries()].map(([symbol, position]) => [symbol, {
      quantity: position.quantity,
      heldShares: position.heldShares,
      availableShares: position.quantity - position.heldShares,
    }])) as ReadonlyMap<string, Readonly<{ readonly quantity: bigint; readonly heldShares: bigint; readonly availableShares: bigint }>>;

    const heldBySymbol = [...this.reservations.values()]
      .filter((reservation) => reservation.accountId === accountId)
      .reduce((map, reservation) => {
        const amount = reservation.side === "BUY" ? reservation.amountRemaining : reservation.qtyRemaining;
        const existing = map.get(reservation.symbol);
        if (existing === undefined) {
          map.set(reservation.symbol, { symbol: reservation.symbol, amount, reason: "RESTING_ORDER" });
          return map;
        }
        map.set(reservation.symbol, { symbol: reservation.symbol, amount: existing.amount + amount, reason: "RESTING_ORDER" });
        return map;
      }, new Map<string, { symbol: string; amount: bigint; reason: "RESTING_ORDER" }>());

    return {
      cash: account.cash,
      heldCash: account.heldCash,
      availableCash: account.cash - account.heldCash,
      positions,
      heldBySymbol: [...heldBySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol)),
    };
  }

  public snapshot(): RiskSnapshot {
    const accounts = [...this.accounts.entries()].map(([accountId, account]) => [accountId, {
      cash: account.cash,
      heldCash: account.heldCash,
      positions: new Map([...account.positions.entries()].map(([symbol, position]) => [symbol, { quantity: position.quantity, heldShares: position.heldShares }])) as ReadonlyMap<string, { readonly quantity: bigint; readonly heldShares: bigint }>,
    }] as const);

    const reservations = [...this.reservations.entries()].map(([orderId, reservation]) => [orderId, {
      orderId: reservation.orderId,
      accountId: reservation.accountId,
      symbol: reservation.symbol,
      side: reservation.side,
      priceCap: reservation.priceCap,
      qtyRemaining: reservation.qtyRemaining,
      amountRemaining: reservation.amountRemaining,
      state: reservation.state,
      placedTs: reservation.placedTs,
      placedSeq: reservation.placedSeq,
      appliedTradeIds: new Set(reservation.appliedTradeIds),
    }] as const);

    return {
      accounts,
      reservations,
      haltedSymbols: [...this.haltedSymbols].sort(),
      dedupe: {
        decidedOrders: this.decisions.size,
        seenRequestIds: this.seenRequestIds.size,
      },
    };
  }

  public checkInvariants(): readonly string[] {
    const violations: string[] = [];
    for (const [accountId, account] of this.accounts.entries()) {
      if (account.heldCash > account.cash) {
        violations.push(`heldCash exceeds cash for ${accountId}`);
      }
      for (const [symbol, position] of account.positions.entries()) {
        if (position.heldShares > position.quantity) {
          violations.push(`heldShares exceed position for ${accountId}:${symbol}`);
        }
      }
    }
    for (const reservation of this.reservations.values()) {
      if (reservation.qtyRemaining < 0n) {
        violations.push(`reservation remaining cannot be negative ${reservation.orderId}`);
      }
      if (reservation.side === "BUY" && reservation.amountRemaining < 0n) {
        violations.push(`BUY reservation amount cannot be negative ${reservation.orderId}`);
      }
    }
    return violations;
  }

  private applyAdjustment(command: StampedRiskCommand): readonly RiskEvent[] {
    const current = command.command;
    if (current.type !== "ApplyAdjustment") {
      return [];
    }

    if (this.adjustmentIds.has(current.adjustmentId)) {
      return [{ type: "AdjustmentRejected", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId, reason: "HOLD_INVARIANT" }];
    }

    const account = this.getAccount(current.accountId);
    if (account === undefined) {
      return [{ type: "AdjustmentRejected", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId, reason: "UNKNOWN_ACCOUNT" }];
    }
    if (current.amount === 0n) {
      return [{ type: "AdjustmentRejected", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId, reason: "ZERO_AMOUNT" }];
    }

    if (current.asset === "CASH") {
      if (account.cash + current.amount < account.heldCash) {
        return [{ type: "AdjustmentRejected", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId, reason: "HOLD_INVARIANT" }];
      }
      account.cash += current.amount;
      this.adjustmentIds.add(current.adjustmentId);
      return [{ type: "AccountAdjusted", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId }];
    }

    if (current.asset.startsWith("SHARES:")) {
      const symbol = current.asset.slice("SHARES:".length);
      const position = this.getPosition(account, symbol);
      if (position.quantity + current.amount < position.heldShares) {
        return [{ type: "AdjustmentRejected", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId, reason: "HOLD_INVARIANT" }];
      }
      position.quantity += current.amount;
      this.adjustmentIds.add(current.adjustmentId);
      return [{ type: "AccountAdjusted", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId }];
    }

    return [{ type: "AdjustmentRejected", accountId: current.accountId, asset: current.asset, amount: current.amount, adjustmentId: current.adjustmentId, reason: "UNKNOWN_ACCOUNT" }];
  }

  private getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  private ensureAccount(accountId: string): Account {
    const existing = this.accounts.get(accountId);
    if (existing !== undefined) {
      return existing;
    }
    const created: Account = { cash: 0n, heldCash: 0n, positions: new Map() };
    this.accounts.set(accountId, created);
    return created;
  }

  private getPosition(account: Account, symbol: string): { quantity: bigint; heldShares: bigint } {
    const existing = account.positions.get(symbol);
    if (existing !== undefined) {
      return existing;
    }
    const created = { quantity: 0n, heldShares: 0n };
    account.positions.set(symbol, created);
    return created;
  }

  private accountSnapshot(accountId: string, symbol: string): AccountSnapshot {
    const account = this.accounts.get(accountId);
    if (account === undefined) {
      return { cash: 0n, heldCash: 0n, availableCash: 0n, positionQuantity: 0n, heldShares: 0n, availableShares: 0n };
    }
    const position = account.positions.get(symbol) ?? { quantity: 0n, heldShares: 0n };
    return {
      cash: account.cash,
      heldCash: account.heldCash,
      availableCash: account.cash - account.heldCash,
      positionQuantity: position.quantity,
      heldShares: position.heldShares,
      availableShares: position.quantity - position.heldShares,
    };
  }

  private releaseReservation(reservation: Reservation, reason: "CANCELLED" | "IOC_REMAINDER" | "MATCHER_REJECTED" | "NEVER_REACHED_MATCHER"): RiskEvent[] {
    const account = this.accounts.get(reservation.accountId);
    if (account === undefined) {
      return [{ type: "UnknownOrderIgnored", orderId: reservation.orderId, command: "ReleaseUnreached" }];
    }

    const releaseAmount = reservation.side === "BUY" ? reservation.priceCap * reservation.qtyRemaining : reservation.qtyRemaining;
    if (reservation.side === "BUY") {
      account.heldCash -= releaseAmount;
    } else {
      const position = this.getPosition(account, reservation.symbol);
      position.heldShares -= reservation.qtyRemaining;
    }
    const event: RiskEvent = {
      type: "ReservationReleased",
      orderId: reservation.orderId,
      accountId: reservation.accountId,
      asset: reservation.side === "BUY" ? "CASH" : `SHARES:${reservation.symbol}`,
      amount: releaseAmount,
      quantity: reservation.qtyRemaining,
      reason,
    };
    this.reservations.delete(reservation.orderId);
    return [event];
  }
}

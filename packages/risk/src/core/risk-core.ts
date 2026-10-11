import type { AccountSnapshot, RiskCommand, RiskConfig, RiskEvent, StampedRiskCommand } from "@matchledger/common";

import { RiskInvariantError } from "./errors.js";
import { computeMarketLimit, resolveReference } from "./reference.js";
import type { Account, Reservation, RiskSnapshot } from "./state.js";

export class RiskCore {
  public readonly decisions = new Set<string>();
  public readonly seenRequestIds = new Set<string>();
  public readonly accounts = new Map<string, Account>();
  public readonly reservations = new Map<string, Reservation>();
  public readonly events: RiskEvent[] = [];
  public readonly commandLog: RiskCommand[] = [];

  public constructor(private readonly config: RiskConfig = { instruments: new Map() }) {}

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
        const needed = priceCap * current.quantity;
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

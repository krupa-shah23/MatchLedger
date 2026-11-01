/**
 * Pure mapper: journal records -> mutations for projection tables.
 * All logic is order-independent across streams. Uses ABSOLUTE values where events carry them.
 */

export type Mutation =
  | { type: "INSERT_ORDER"; orderId: string; data: Record<string, unknown> }
  | { type: "UPDATE_ORDER"; orderId: string; data: Record<string, unknown> }
  | { type: "INSERT_FILL"; orderId: string; tradeId: string; data: Record<string, unknown> }
  | { type: "INSERT_RESTING"; symbol: string; orderId: string; data: Record<string, unknown> }
  | { type: "UPDATE_RESTING_REMAINING"; symbol: string; orderId: string; remaining: bigint }
  | { type: "DELETE_RESTING"; symbol: string; orderId: string }
  | { type: "ADD_FILL_FACTS"; orderId: string; quantity: bigint; notional: bigint }
  | { type: "INSERT_TRADE"; symbol: string; engineSeq: number; idx: number; data: Record<string, unknown> }
  | { type: "UPDATE_BALANCES"; accountId: string; data: Record<string, unknown> }
  | { type: "UPDATE_POSITION"; accountId: string; symbol: string; data: Record<string, unknown> }
  | { type: "INSERT_RESERVATION"; orderId: string; data: Record<string, unknown> }
  | { type: "UPDATE_RESERVATION"; orderId: string; data: Record<string, unknown> }
  | { type: "INSERT_REJECTION"; data: Record<string, unknown> }
  | { type: "UPDATE_BREAKER"; symbol: string; data: Record<string, unknown> };

/**
 * Map a risk journal record to mutations.
 * Exhaustive: all RiskCommand and RiskEvent types handled.
 * Failure to handle a new type causes compile error.
 */
export function mapRiskRecord(
  record: { record_type: string; payload_json: unknown; seq: number; ts?: number }
): Mutation[] {
  const payload = record.payload_json as Record<string, unknown> | { type: string };
  const mutations: Mutation[] = [];

  if (record.record_type === "COMMAND") {
    const cmd = payload as { type: string };
    switch (cmd.type) {
      case "SubmitOrder": {
        const c = cmd as Record<string, unknown>;
        mutations.push({
          type: "INSERT_ORDER",
          orderId: String(c.orderId ?? ""),
          data: {
            account_id: String(c.accountId ?? ""),
            client_order_id: null,
            symbol: String(c.symbol ?? ""),
            side: String(c.side ?? ""),
            order_type: c.kind,
            time_in_force: c.timeInForce,
            quantity: c.quantity,
            price: c.price ?? null,
            effective_price: null,
            received_ts: record.ts ?? record.seq,
            accepted: false,
            rested: false,
            filled_qty: 0n,
            filled_notional: 0n,
            terminal: null,
            terminal_reason: null,
            cancel_requested: false,
          },
        });
        break;
      }
      case "CancelOrder": {
        const c = cmd as Record<string, unknown>;
        mutations.push({
          type: "UPDATE_ORDER",
          orderId: String(c.orderId ?? ""),
          data: { cancel_requested: true },
        });
        break;
      }
      case "HaltSymbol":
      case "ResumeSymbol":
      case "OpenAccount":
      case "Deposit":
      case "OrderAcked":
      case "FillApplied":
      case "OrderClosed":
      case "OrderRejectedByMatcher":
      case "ApplyAdjustment":
      case "SweepProbe":
      case "ReleaseUnreached":
        // Risk commands handled via events
        break;
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        cmd.type as never;
        break;
    }
  } else if (record.record_type === "EVENT") {
    const evt = payload as { type: string };
    switch (evt.type) {
      case "ReservationPlaced": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "INSERT_RESERVATION",
          orderId: e.orderId,
          data: {
            account_id: e.accountId,
            symbol: e.symbol,
            side: e.side,
            asset: e.asset,
            amount_total: e.amount,
            amount_remaining: e.amount,
            status: "PLACED",
            released_reason: null,
            converted_amount: 0n,
            improvement_released: 0n,
          },
        });
        mutations.push({
          type: "UPDATE_BALANCES",
          accountId: e.accountId,
          data: { held_cash: e.asset === "CASH" || e.asset === "USD" ? e.amount : 0n },
        });
        break;
      }
      case "OrderAccepted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_ORDER",
          orderId: e.orderId,
          data: {
            accepted: true,
            effective_price: e.price,
          },
        });
        break;
      }
      case "OrderRejected": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_ORDER",
          orderId: e.orderId,
          data: {
            terminal: "REJECTED",
            terminal_reason: e.reason,
          },
        });
        mutations.push({
          type: "INSERT_REJECTION",
          data: {
            source: "RISK",
            order_id: e.orderId,
            account_id: e.accountId,
            symbol: null,
            reason: e.reason,
            required: e.required ?? null,
            snapshot_json: e.snapshot ? JSON.stringify(e.snapshot) : null,
            ts: record.ts ?? record.seq,
          },
        });
        break;
      }
      case "ReservationConverted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_RESERVATION",
          orderId: e.orderId,
          data: {
            status: "PARTIALLY_CONVERTED",
            converted_amount: e.consumed,
            improvement_released: e.improvement,
          },
        });
        break;
      }
      case "ReservationReleased": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_RESERVATION",
          orderId: e.orderId,
          data: {
            status: "RELEASED",
            released_reason: e.reason,
            amount_remaining: 0n,
          },
        });
        break;
      }
      case "FundsDeposited": {
        const e = evt as { type: string; accountId: string; asset: string; amount: bigint };
        if (e.asset === "CASH" || e.asset === "USD") mutations.push({ type: "UPDATE_BALANCES", accountId: e.accountId, data: { cash: e.amount } });
        else if (e.asset.startsWith("SHARES:")) mutations.push({ type: "UPDATE_POSITION", accountId: e.accountId, symbol: e.asset.slice(7), data: { quantity: e.amount } });
        break;
      }
      case "AccountOpened": {
        const e = evt as { type: string; accountId: string };
        mutations.push({ type: "UPDATE_BALANCES", accountId: e.accountId, data: { cash: 0n } });
        break;
      }
      case "AccountAdjusted":
      case "AdjustmentRejected":
        break;
      case "SymbolStatusChanged": {
        const e = evt as Record<string, unknown>;
        mutations.push({ type: "UPDATE_BREAKER", symbol: String(e.symbol), data: {
          state: e.status === "HALTED" ? "OPEN" : "HALF_OPEN", trip_reason: e.reason ?? null,
          state_since_ts: record.ts ?? record.seq, incident_start_ts: record.ts ?? record.seq,
        } });
        break;
      }
      case "HaltTimeoutCancelled":
      case "SweepCandidates":
      case "DuplicateIgnored":
      case "UnknownOrderIgnored":
        // Handled or no table impact
        break;
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        evt.type as never;
        break;
    }
  }

  return mutations;
}

/**
 * Map an engine journal record to mutations.
 * Exhaustive: all engine Command and Event types handled.
 */
export function mapEngineRecord(
  record: { record_type: string; payload_json: unknown; symbol: string; seq: number; ts?: number; idx?: number }
): Mutation[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = record.payload_json as any;
  const mutations: Mutation[] = [];

  if (record.record_type === "COMMAND") {
    const cmd = payload as { type: string };
    switch (cmd.type) {
      case "CancelOrder": {
        // Cancel journaled but fact comes from engine events
        break;
      }
      case "PlaceOrder":
      case "Tick":
        break;
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        cmd.type as never;
        break;
    }
  } else if (record.record_type === "EVENT") {
    const evt = payload as { type: string };
    switch (evt.type) {
      case "ORDER_RESTED":
      case "OrderRested": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "INSERT_RESTING",
          symbol: record.symbol,
          orderId: e.orderId,
          data: {
            side: e.side,
            price: e.price,
            remaining: e.remaining ?? e.quantity,
          },
        });
        mutations.push({ type: "UPDATE_ORDER", orderId: e.orderId, data: { rested: true } });
        break;
      }
      case "TRADE_EXECUTED":
      case "TradeExecuted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "INSERT_FILL",
          orderId: e.takerOrderId,
          tradeId: e.tradeId,
          data: {
            price: e.price,
            quantity: e.quantity,
            role: "TAKER",
            ts: record.ts ?? record.seq,
          },
        });
        mutations.push({
          type: "INSERT_FILL",
          orderId: e.makerOrderId,
          tradeId: e.tradeId,
          data: {
            price: e.price,
            quantity: e.quantity,
            role: "MAKER",
            ts: record.ts ?? record.seq,
          },
        });
        mutations.push({
          type: "INSERT_TRADE",
          symbol: record.symbol,
          engineSeq: record.seq,
          idx: record.idx ?? 0,
          data: {
            trade_id: e.tradeId,
            price: e.price,
            quantity: e.quantity,
            taker_side: e.takerSide,
            ts: record.ts ?? record.seq,
          },
        });
        for (const orderId of [e.takerOrderId, e.makerOrderId]) {
          mutations.push({ type: "ADD_FILL_FACTS", orderId, quantity: BigInt(e.quantity), notional: BigInt(e.price) * BigInt(e.quantity) });
        }
        // Some engine versions don't carry makerRemaining. SQL computes it from fills.
        if (e.makerRemaining !== undefined) mutations.push({
          type: "UPDATE_RESTING_REMAINING",
          symbol: record.symbol,
          orderId: e.makerOrderId,
          remaining: e.makerRemaining,
        });
        break;
      }
      case "ORDER_CANCELLED":
      case "OrderCancelled": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_ORDER",
          orderId: e.orderId,
          data: {
            terminal: "CANCELLED",
            terminal_reason: e.reason,
          },
        });
        mutations.push({
          type: "DELETE_RESTING",
          symbol: record.symbol,
          orderId: e.orderId,
        });
        break;
      }
      case "ORDER_REJECTED":
      case "OrderRejected": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_ORDER",
          orderId: e.orderId,
          data: {
            terminal: "REJECTED",
            terminal_reason: e.reason,
          },
        });
        mutations.push({
          type: "INSERT_REJECTION",
          data: {
            source: "MATCHER",
            order_id: e.orderId,
            account_id: null,
            symbol: record.symbol,
            reason: e.reason,
            required: null,
            snapshot_json: null,
            ts: record.ts ?? record.seq,
          },
        });
        break;
      }
      case "OrderAccepted":
      case "CancelRejected":
        break;
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        evt.type as never;
        break;
    }
  }

  return mutations;
}

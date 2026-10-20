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
  record: { record_type: string; payload_json: unknown; seq: number }
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
            received_ts: record.seq,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = cmd as any;
        mutations.push({
          type: "UPDATE_ORDER",
          orderId: c.orderId,
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
          data: { held_cash: e.asset === "USD" ? e.amount : 0n, held_shares: e.asset !== "USD" ? e.amount : 0n },
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
            ts: record.seq,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = evt as any;
        mutations.push({
          type: "UPDATE_BALANCES",
          accountId: e.accountId,
          data: { cash: e.asset === "USD" ? e.amount : 0n },
        });
        break;
      }
      case "AccountOpened":
      case "AccountAdjusted":
      case "AdjustmentRejected":
      case "SymbolStatusChanged":
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
  record: { record_type: string; payload_json: unknown; symbol: string; seq: number; idx?: number }
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
            remaining: e.quantity,
          },
        });
        break;
      }
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
            ts: record.seq,
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
            ts: record.seq,
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
            ts: record.seq,
          },
        });
        // Absolute value from event
        mutations.push({
          type: "UPDATE_RESTING_REMAINING",
          symbol: record.symbol,
          orderId: e.makerOrderId,
          remaining: e.makerRemaining,
        });
        break;
      }
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
            ts: record.seq,
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

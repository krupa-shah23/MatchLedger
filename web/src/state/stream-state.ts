/**
 * Pure reducer for managing order, market, and account state from WebSocket events.
 *
 * Signature: reduce(state, event) -> { state, effects }
 *
 * Invariants:
 * - Pure: no side effects, no external I/O
 * - Idempotent: applying the same event twice produces the same result as once
 * - Ordered: events are processed in order; order is guaranteed by subscription
 * - Live: state reflects the live server state; crashes/disconnects mean replay
 */

export interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  quantityFilled: string;
  effectivePrice: string | null;
  status: "PENDING_ACK" | "ACCEPTED" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED" | "REJECTED";
  reservationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketData {
  symbol: string;
  bids: Array<[price: string, quantity: string]>;
  asks: Array<[price: string, quantity: string]>;
  lastTrade: { price: string; quantity: string; time: string } | null;
}

export interface StreamState {
  orders: Map<string, Order>;
  market: Map<string, MarketData>;
  account: {
    balance: string;
    reserved: string;
    positions: Map<string, string>;
  };
  lastEventId: string;
  lastEventTime: string;
}

export interface StreamEvent {
  type: string;
  id: string;
  timestamp: string;
  payload: unknown;
}

export type Effect =
  | { type: "refetch"; resource: "orders" | "market" | "account" }
  | { type: "notify"; message: string; level: "info" | "warning" | "error" };

export interface StreamResult {
  state: StreamState;
  effects: Effect[];
}

export function createInitialState(): StreamState {
  return {
    orders: new Map(),
    market: new Map(),
    account: {
      balance: "0",
      reserved: "0",
      positions: new Map(),
    },
    lastEventId: "",
    lastEventTime: "",
  };
}

export function reduce(state: StreamState, event: StreamEvent): StreamResult {
  const effects: Effect[] = [];

  // Idempotency check: if we've already processed this event, return unchanged
  if (event.id <= state.lastEventId && event.timestamp <= state.lastEventTime) {
    return { state, effects };
  }

  const newState = { ...state };
  newState.orders = new Map(state.orders);
  newState.market = new Map(state.market);
  newState.account = { ...state.account, positions: new Map(state.account.positions) };
  newState.lastEventId = event.id;
  newState.lastEventTime = event.timestamp;

  const payload = event.payload as Record<string, unknown>;

  switch (event.type) {
    case "order.placed": {
      const order: Order = {
        id: payload.id as string,
        symbol: payload.symbol as string,
        side: payload.side as "BUY" | "SELL",
        quantity: payload.quantity as string,
        quantityFilled: "0",
        effectivePrice: null,
        status: "PENDING_ACK",
        reservationId: null,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
      newState.orders.set(order.id, order);
      break;
    }

    case "order.accepted": {
      const orderId = payload.id as string;
      const order = newState.orders.get(orderId);
      if (order) {
        order.status = "ACCEPTED";
        order.reservationId = payload.reservationId as string;
        order.updatedAt = event.timestamp;
      }
      break;
    }

    case "order.filled": {
      const orderId = payload.id as string;
      const order = newState.orders.get(orderId);
      if (order) {
        order.quantityFilled = payload.quantityFilled as string;
        order.effectivePrice = payload.effectivePrice as string;
        order.status = payload.quantityFilled === order.quantity ? "FILLED" : "PARTIALLY_FILLED";
        order.updatedAt = event.timestamp;

        // Update account position
        const symbol = order.symbol;
        const qtyStr = String(payload.quantityFilled || "0");
        const qty = BigInt(qtyStr);
        const current = BigInt(newState.account.positions.get(symbol) || "0");
        const side = order.side === "BUY" ? 1n : -1n;
        newState.account.positions.set(symbol, (current + qty * side).toString());
      }
      break;
    }

    case "order.cancelled": {
      const orderId = payload.id as string;
      const order = newState.orders.get(orderId);
      if (order) {
        order.status = "CANCELLED";
        order.updatedAt = event.timestamp;
      }
      break;
    }

    case "order.rejected": {
      const orderId = payload.id as string;
      const order = newState.orders.get(orderId);
      if (order) {
        order.status = "REJECTED";
        order.updatedAt = event.timestamp;
      }
      break;
    }

    case "market.update": {
      const symbol = payload.symbol as string;
      const market: MarketData = {
        symbol,
        bids: (payload.bids as Array<[string, string]>) || [],
        asks: (payload.asks as Array<[string, string]>) || [],
        lastTrade: (payload.lastTrade as { price: string; quantity: string; time: string } | null) || null,
      };
      newState.market.set(symbol, market);
      break;
    }

    case "account.updated": {
      const balance = payload.balance;
      const reserved = payload.reserved;
      if (typeof balance === "string") newState.account.balance = balance;
      if (typeof reserved === "string") newState.account.reserved = reserved;
      const positions = payload.positions;
      if (positions && typeof positions === "object") {
        newState.account.positions.clear();
        const posMap = positions as Record<string, unknown>;
        for (const sym in posMap) {
          const qty = posMap[sym];
          if (typeof qty === "string") {
            newState.account.positions.set(sym, qty);
          }
        }
      }
      break;
    }

    default: {
      // Unknown event type - trigger refetch to catch up
      effects.push({ type: "refetch", resource: "orders" });
      break;
    }
  }

  return { state: newState, effects };
}

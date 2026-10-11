import type { PlaceOrder as EnginePlaceOrder } from "@matchledger/engine-core";

import type { RiskEvent } from "./risk-types.js";

/**
 * Converts a risk-stage acceptance into the engine's place-order command.
 * The shard stamper overwrites the placeholder ts before the command is journaled.
 */
export function acceptedToPlaceOrder(event: Extract<RiskEvent, { type: "OrderAccepted" }>): EnginePlaceOrder {
  return {
    kind: "PLACE",
    ts: 0n,
    orderId: event.orderId,
    accountId: event.accountId,
    side: event.side,
    orderType: "IOC",
    timeInForce: event.timeInForce,
    price: event.price,
    quantity: event.quantity,
  };
}

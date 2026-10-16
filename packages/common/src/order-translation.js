/**
 * Converts a risk-stage acceptance into the engine's place-order command.
 * The shard stamper overwrites the placeholder ts before the command is journaled.
 */
export function acceptedToPlaceOrder(event) {
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

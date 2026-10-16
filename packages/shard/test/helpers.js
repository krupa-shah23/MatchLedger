export class FakeClock {
    readings;
    index = 0;
    constructor(readings) {
        this.readings = readings;
    }
    now() {
        const reading = this.readings[Math.min(this.index, this.readings.length - 1)] ?? 0;
        this.index += 1;
        return reading;
    }
    set(value) {
        this.readings.splice(0, this.readings.length, value);
        this.index = 0;
    }
}
export const ACME = {
    symbol: "ACME",
    tickSize: 1n,
    lotSize: 1n,
    maxQuantity: 1000000n,
    maxPrice: 1000000n,
};
export const BETA = {
    symbol: "BETA",
    tickSize: 5n,
    lotSize: 10n,
    maxQuantity: 1000000n,
    maxPrice: 1000000n,
};
export function place(orderId, side = "BUY", price = 100n, quantity = 1n) {
    return {
        kind: "PLACE",
        ts: 0n,
        orderId,
        accountId: "account-1",
        side,
        orderType: "LIMIT",
        timeInForce: "GTC",
        price,
        quantity,
    };
}
export function cancel(orderId) {
    return { kind: "CANCEL", ts: 0n, orderId };
}
export async function settle(runner) {
    await runner.stop({ drain: true });
    await runner.done;
}

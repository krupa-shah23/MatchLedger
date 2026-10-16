// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
export function decide(state, request) {
    if (request.need <= 0n) {
        return { result: { orderId: request.orderId, accepted: false, reason: "INVALID_AMOUNT" }, next: undefined };
    }
    if (state.cash - state.held < request.need) {
        return { result: { orderId: request.orderId, accepted: false, reason: "INSUFFICIENT_BALANCE" }, next: undefined };
    }
    return {
        result: { orderId: request.orderId, accepted: true },
        next: { cash: state.cash, held: state.held + request.need },
    };
}

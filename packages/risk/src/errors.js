// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.
export class UnknownAccountError extends Error {
    constructor(accountId) {
        super(`Unknown account: ${accountId}`);
        this.name = "UnknownAccountError";
    }
}
export class RiskFailedError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "RiskFailedError";
    }
}

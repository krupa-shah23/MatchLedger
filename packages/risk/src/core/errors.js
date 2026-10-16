export class RiskInvariantError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "RiskInvariantError";
        this.code = code;
    }
}
export class InvalidRiskStateError extends Error {
    reason;
    constructor(reason, message) {
        super(message);
        this.name = "InvalidRiskStateError";
        this.reason = reason;
    }
}

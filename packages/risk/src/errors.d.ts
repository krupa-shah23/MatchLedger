export declare class UnknownAccountError extends Error {
    constructor(accountId: string);
}
export declare class RiskFailedError extends Error {
    constructor(message: string, options?: {
        readonly cause?: unknown;
    });
}

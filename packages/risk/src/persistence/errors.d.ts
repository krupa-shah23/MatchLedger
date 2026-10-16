export declare class OrderOwnerConflictError extends Error {
    readonly orderId: string;
    constructor(orderId: string, message: string);
}

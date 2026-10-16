export class OrderOwnerConflictError extends Error {
    orderId;
    constructor(orderId, message) {
        super(message);
        this.orderId = orderId;
        this.name = "OrderOwnerConflictError";
    }
}

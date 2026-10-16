export class OrderOwnerConflictError extends Error {
  public constructor(public readonly orderId: string, message: string) {
    super(message);
    this.name = "OrderOwnerConflictError";
  }
}

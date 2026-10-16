export class InvalidSnapshotError extends Error {
    reason;
    constructor(reason, detail) {
        super(`${reason}: ${detail}`);
        this.reason = reason;
        this.name = "InvalidSnapshotError";
    }
}

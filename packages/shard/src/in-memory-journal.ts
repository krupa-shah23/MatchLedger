import type { JournalAppender, StampedCommand } from "@matchledger/common";

type Pending = { readonly resolve: () => void; readonly reject: (error: unknown) => void; readonly batch: readonly StampedCommand[] };

export class InMemoryJournal implements JournalAppender {
  public readonly batches: StampedCommand[][] = [];
  public appendCalls = 0;
  private held = false;
  private pending: Pending[] = [];
  private failureCall: { readonly call: number; readonly error: unknown } | undefined;

  public constructor(private readonly delaySchedule: readonly number[] = []) {}

  public append(batch: readonly StampedCommand[]): Promise<void> {
    this.appendCalls += 1;
    const call = this.appendCalls;
    return this.withDelay(call, () => new Promise<void>((resolve, reject) => {
      if (this.failureCall?.call === call) {
        const error = this.failureCall.error;
        this.failureCall = undefined;
        reject(error);
        return;
      }
      const complete = (): void => {
        this.batches.push(Array.from(batch));
        resolve();
      };
      if (this.held) this.pending.push({ resolve: complete, reject, batch });
      else complete();
    }));
  }

  public all(): StampedCommand[] {
    return this.batches.flatMap((batch) => batch);
  }

  public hold(): void {
    this.held = true;
  }

  public release(): void {
    this.held = false;
    const pending = this.pending;
    this.pending = [];
    for (const item of pending) item.resolve();
  }

  public failOnCall(call: number, error: unknown): void {
    this.failureCall = { call, error };
  }

  public failNext(error: unknown): void {
    this.failOnCall(this.appendCalls + 1, error);
  }

  private async withDelay<T>(call: number, operation: () => Promise<T>): Promise<T> {
    for (let remaining = this.delaySchedule[call - 1] ?? 0; remaining > 0; remaining -= 1) {
      await Promise.resolve();
    }
    return operation();
  }
}

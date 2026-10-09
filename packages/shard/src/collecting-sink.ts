import type { EventSink, ShardOutput } from "@matchledger/common";

type Pending = { readonly resolve: () => void; readonly reject: (error: unknown) => void };

export class CollectingSink implements EventSink {
  public readonly batches: ShardOutput[][] = [];
  public publishCalls = 0;
  private held = false;
  private pending: Pending[] = [];
  private failureCall: { readonly call: number; readonly error: unknown } | undefined;

  public constructor(private readonly delaySchedule: readonly number[] = []) {}

  public publish(batch: readonly ShardOutput[]): Promise<void> {
    this.publishCalls += 1;
    const call = this.publishCalls;
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
      if (this.held) this.pending.push({ resolve: complete, reject });
      else complete();
    }));
  }

  public all(): ShardOutput[] {
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
    this.failOnCall(this.publishCalls + 1, error);
  }

  private async withDelay<T>(call: number, operation: () => Promise<T>): Promise<T> {
    for (let remaining = this.delaySchedule[call - 1] ?? 0; remaining > 0; remaining -= 1) {
      await Promise.resolve();
    }
    return operation();
  }
}

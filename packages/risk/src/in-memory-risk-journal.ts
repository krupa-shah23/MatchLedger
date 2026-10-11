import type { RiskJournalAppender, StampedRiskCommand } from "@matchledger/common";

export class InMemoryRiskJournal implements RiskJournalAppender {
  public readonly batches: StampedRiskCommand[][] = [];

  private holdCount = 0;
  private failNextError: Error | undefined;
  private readonly failOnCalls = new Map<number, Error>();
  private readonly schedule: readonly number[];
  private scheduleIndex = 0;

  public constructor(opts?: { readonly delaySchedule?: readonly number[] }) {
    this.schedule = opts?.delaySchedule ?? [];
  }

  public hold(): void {
    this.holdCount += 1;
  }

  public release(): void {
    this.holdCount = Math.max(0, this.holdCount - 1);
  }

  public failNext(error: Error): void {
    this.failNextError = error;
  }

  public failOnCall(n: number, error: Error): void {
    this.failOnCalls.set(n, error);
  }

  public all(): readonly StampedRiskCommand[] {
    return this.batches.flatMap((batch) => batch);
  }

  public async append(batch: readonly StampedRiskCommand[]): Promise<void> {
    while (this.holdCount > 0) {
      await Promise.resolve();
    }

    const callNumber = this.batches.length + 1;
    if (this.failNextError !== undefined) {
      const error = this.failNextError;
      this.failNextError = undefined;
      throw error;
    }
    if (this.failOnCalls.has(callNumber)) {
      throw this.failOnCalls.get(callNumber)!;
    }

    for (const delay of this.schedule) {
      if (delay > 0) {
        for (let index = 0; index < delay; index += 1) {
          await Promise.resolve();
        }
      } else {
        await Promise.resolve();
      }
    }
    if (this.schedule.length > 0) {
      this.scheduleIndex = (this.scheduleIndex + 1) % this.schedule.length;
    }

    this.batches.push([...batch]);
  }
}

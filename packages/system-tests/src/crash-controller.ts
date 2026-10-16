export type CrashKind = "risk.journal.append" | "risk.events.append" | "shard.enqueue" | "engine.events.append" | "ledger.append" | "risk.snapshot.save" | "core.apply";
export type CrashTiming = "before" | "after";

export class SimulatedCrash extends Error {
  constructor(readonly kind: CrashKind, readonly timing: CrashTiming) {
    super(`Simulated crash at ${timing} ${kind}`);
    this.name = "SimulatedCrash";
  }
}

export class CrashController {
  crashed = false;
  private plan?: { kind: CrashKind; nth: number; when: CrashTiming };
  private callCount = new Map<string, number>();

  constructor() {}

  arm(plan: { kind: CrashKind; nth: number; when: CrashTiming }): void {
    this.plan = plan;
  }

  private check(kind: CrashKind, timing: CrashTiming): void {
    if (this.crashed) throw new SimulatedCrash(kind, timing);
    if (!this.plan || this.plan.kind !== kind || this.plan.when !== timing) return;

    const key = `${kind}:${timing}`;
    const count = (this.callCount.get(key) ?? 0) + 1;
    this.callCount.set(key, count);

    if (count === this.plan.nth) {
      this.crashed = true;
      throw new SimulatedCrash(kind, timing);
    }
  }

  wrapAsync<T>(kind: CrashKind, fn: () => Promise<T>): Promise<T> {
    this.check(kind, "before");
    return fn().then((result) => {
      this.check(kind, "after");
      return result;
    });
  }

  wrapSync<T>(kind: CrashKind, fn: () => T): T {
    this.check(kind, "before");
    const result = fn();
    this.check(kind, "after");
    return result;
  }
}

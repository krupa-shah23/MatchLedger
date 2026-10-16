export class SimulatedCrash extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulatedCrash";
  }
}

export type CrashKind =
  | "engine.journal.append"
  | "engine.events.append"
  | "engine.snapshot.save"
  | "risk.journal.append"
  | "risk.events.append"
  | "risk.snapshot.save"
  | "ledger.append"
  | "shard.enqueue"
  | "stage.notify";

export interface CrashPlan {
  kind: CrashKind;
  nth: number;
  when: "before" | "after";
}

export class CrashController {
  private plan: CrashPlan | null = null;
  private callCounts = new Map<CrashKind, number>();
  public crashed = false;

  arm(plan: CrashPlan): void {
    this.plan = plan;
    this.callCounts.clear();
    this.crashed = false;
  }

  async trip(kind: CrashKind, when: "before" | "after", fn: () => Promise<void>): Promise<void> {
    const count = (this.callCounts.get(kind) ?? 0) + 1;
    this.callCounts.set(kind, count);

    if (this.crashed) {
      throw new SimulatedCrash(`Already crashed; no more calls allowed`);
    }

    if (this.plan && this.plan.kind === kind && this.plan.nth === count && this.plan.when === when) {
      this.crashed = true;
      throw new SimulatedCrash(`Crash at ${kind} #${count} (${when})`);
    }

    if (!this.crashed) {
      await fn();
    } else {
      throw new SimulatedCrash(`Already crashed; call to ${kind} rejected`);
    }
  }

  callCount(kind: CrashKind): number {
    return this.callCounts.get(kind) ?? 0;
  }
}

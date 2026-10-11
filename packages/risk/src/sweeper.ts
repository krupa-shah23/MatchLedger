import type { RiskStage } from "./stage.js";

export class LeakSweeper {
  public constructor(
    private readonly opts: {
      readonly stage: RiskStage;
      readonly olderThanMs: number;
    },
  ) {}

  public tick(): void {
    this.opts.stage.probe(this.opts.olderThanMs);
  }
}

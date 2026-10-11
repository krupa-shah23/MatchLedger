import type { RiskCommand, RiskEvent, StampedRiskCommand } from "@matchledger/common";

/**
 * Week 6 RiskCore stub.
 *
 * The Week 6 spec requires the hand-written reservation lifecycle methods to be written
 * by the human owner in a later review step. The class exists to anchor the contract,
 * method names, and event signatures without implementing the state mutation logic.
 */
export class RiskCore {
  public apply(_command: StampedRiskCommand): readonly RiskEvent[] {
    void _command;
    throw new Error("RiskCore.apply is deliberately stubbed for the Week 6 review step");
  }

  public onSubmitOrder(_command: StampedRiskCommand): readonly RiskEvent[] {
    void _command;
    throw new Error("RiskCore.onSubmitOrder is deliberately stubbed for the Week 6 review step");
  }

  public onFill(_command: StampedRiskCommand): readonly RiskEvent[] {
    void _command;
    throw new Error("RiskCore.onFill is deliberately stubbed for the Week 6 review step");
  }

  public onClose(_command: StampedRiskCommand): readonly RiskEvent[] {
    void _command;
    throw new Error("RiskCore.onClose is deliberately stubbed for the Week 6 review step");
  }

  public snapshot(): unknown {
    throw new Error("RiskCore.snapshot is deliberately stubbed for the Week 6 review step");
  }

  public readonly decisions = new Set<string>();
  public readonly seenRequestIds = new Set<string>();
  public readonly accounts = new Map<string, unknown>();
  public readonly reservations = new Map<string, unknown>();
  public readonly events: readonly RiskEvent[] = [];
  public readonly commandLog: readonly RiskCommand[] = [];
}

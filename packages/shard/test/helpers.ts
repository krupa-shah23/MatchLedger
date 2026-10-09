import type { Clock } from "@matchledger/common";
import type { Command, InstrumentConfig, Side } from "@matchledger/engine-core";

export class FakeClock implements Clock {
  private index = 0;

  public constructor(public readonly readings: number[]) {}

  public now(): number {
    const reading = this.readings[Math.min(this.index, this.readings.length - 1)] ?? 0;
    this.index += 1;
    return reading;
  }

  public set(value: number): void {
    this.readings.splice(0, this.readings.length, value);
    this.index = 0;
  }
}

export const ACME: InstrumentConfig = {
  symbol: "ACME",
  tickSize: 1n,
  lotSize: 1n,
  maxQuantity: 1_000_000n,
  maxPrice: 1_000_000n,
};

export const BETA: InstrumentConfig = {
  symbol: "BETA",
  tickSize: 5n,
  lotSize: 10n,
  maxQuantity: 1_000_000n,
  maxPrice: 1_000_000n,
};

export function place(
  orderId: string,
  side: Side = "BUY",
  price = 100n,
  quantity = 1n,
): Command {
  return {
    kind: "PLACE",
    ts: 0n,
    orderId,
    accountId: "account-1",
    side,
    orderType: "LIMIT",
    timeInForce: "GTC",
    price,
    quantity,
  };
}

export function cancel(orderId: string): Command {
  return { kind: "CANCEL", ts: 0n, orderId };
}

export async function settle(runner: { stop(options?: { drain?: boolean }): Promise<void>; done: Promise<unknown> }): Promise<void> {
  await runner.stop({ drain: true });
  await runner.done;
}

import type { Clock } from "@matchledger/common";

export const systemClock: Clock = { now: () => Date.now() };

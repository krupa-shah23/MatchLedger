import { setImmediate } from "node:timers/promises";

export function yieldToEventLoop(): Promise<void> {
  return setImmediate();
}

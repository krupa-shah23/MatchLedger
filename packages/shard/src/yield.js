import { setImmediate } from "node:timers/promises";
export function yieldToEventLoop() {
    return setImmediate();
}

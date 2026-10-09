import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  AsyncAccountStore,
  decide,
  microtaskDelay,
  NaiveRisk,
  scheduleDelay,
  SerializedRisk,
  UnknownAccountError,
} from "../src/index.js";
import type { AccountState, ReserveRequest, ReserveResult, RiskHooks } from "../src/types.js";

const request = (orderId: string, need: bigint): ReserveRequest => ({ accountId: "acc1", orderId, need });
const storeFor = (cash: bigint, delay: () => Promise<void> = microtaskDelay): AsyncAccountStore =>
  new AsyncAccountStore(new Map<string, AccountState>([["acc1", { cash, held: 0n }]]), delay);

async function runConcurrent(handler: NaiveRisk, requests: readonly ReserveRequest[]): Promise<PromiseSettledResult<ReserveResult>[]> {
  return Promise.allSettled(requests.map((item) => handler.handle(item)));
}

function committed(results: readonly PromiseSettledResult<ReserveResult>[], requests: readonly ReserveRequest[]): bigint {
  return results.reduce((total, result, index) => total + (result.status === "fulfilled" && result.value.accepted ? requests[index]?.need ?? 0n : 0n), 0n);
}

describe("Week 4 risk prototype", () => {
  it("decide handles amount and balance boundaries without mutation", () => {
    const state = { cash: 100n, held: 20n };
    expect(decide(state, request("zero", 0n)).result.reason).toBe("INVALID_AMOUNT");
    expect(decide(state, request("negative", -1n)).result.reason).toBe("INVALID_AMOUNT");
    expect(decide(state, request("exact", 80n)).next).toEqual({ cash: 100n, held: 100n });
    expect(decide(state, request("over", 81n)).result.reason).toBe("INSUFFICIENT_BALANCE");
    expect(state).toEqual({ cash: 100n, held: 20n });
  });

  it("AsyncAccountStore copies values and rejects unknown accounts", async () => {
    const store = storeFor(100n);
    const read = await store.read("acc1");
    const mutated = { ...read, held: 90n };
    expect(mutated.held).toBe(90n);
    expect(store.peek("acc1").held).toBe(0n);
    await store.write("acc1", { cash: 100n, held: 40n });
    const peek = store.peek("acc1");
    expect(peek).toEqual({ cash: 100n, held: 40n });
    const mutatedPeek = { ...peek, held: 0n };
    expect(mutatedPeek.held).toBe(0n);
    await expect(store.read("missing")).rejects.toBeInstanceOf(UnknownAccountError);
    await expect(store.write("missing", { cash: 1n, held: 0n })).rejects.toBeInstanceOf(UnknownAccountError);
  });

  // This test is proof; keep it forever. If it ever fails, the naive version stopped being naive.
  it("C2 proves the naive comparison can overspend", async () => {
    const store = storeFor(100n);
    const handler = new NaiveRisk(store);
    const requests = [request("a", 80n), request("b", 80n)];
    const results = await runConcurrent(handler, requests);
    expect(committed(results, requests)).toBeGreaterThan(100n);
    expect(store.peek("acc1").held).toBe(80n);
  });

  it("C2b serializes the same reservation scenarios", async () => {
    const store = storeFor(100n);
    const handler = new SerializedRisk(store, { queueCapacity: 10 });
    const results = await Promise.all([handler.submit(request("a", 80n)), handler.submit(request("b", 80n))]);
    expect(results.map((result) => result.accepted)).toEqual([true, false]);
    await handler.stop();
  });

  it("C6 compares deterministic schedules", async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 50 }), async (schedule) => {
      const store = storeFor(500n, scheduleDelay(schedule));
      const handler = new SerializedRisk(store, { queueCapacity: 250 });
      const requests = Array.from({ length: 200 }, (_, index) => request(`o${index}`, BigInt((index % 20) + 1)));
      const results = await Promise.all(requests.map((item) => handler.submit(item)));
      expect(results.filter((result) => result.accepted).reduce((sum, result, index) => sum + (result.accepted ? requests[index]?.need ?? 0n : 0n), 0n)).toBeLessThanOrEqual(500n);
      await handler.stop();
    }), { numRuns: 200 });
  });

  it("RK1 exposes the serialized failure behavior", async () => {
    const store = storeFor(1_000n);
    const error = new Error("write failure");
    store.failWriteOnCall(5, error);
    const handler = new SerializedRisk(store, { queueCapacity: 30 });
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => handler.submit(request(`o${index}`, 1n))));
    expect(results.some((result) => result.status === "rejected")).toBe(true);
    await expect(handler.done).resolves.toBeUndefined();
  });

  it("hooks are specified for both handlers", () => {
    const hooks: RiskHooks = { onHandlerStart: () => undefined, onHandlerEnd: () => undefined };
    expect(new NaiveRisk(storeFor(1n), hooks)).toBeDefined();
    expect(new SerializedRisk(storeFor(1n), { queueCapacity: 1, hooks })).toBeDefined();
  });
});

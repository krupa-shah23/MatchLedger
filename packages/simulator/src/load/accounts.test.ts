import { describe, expect, it } from "vitest";
import { seedLoadAccounts, type LoadFetch } from "./accounts.js";

describe("LG6: load account seeding uses the admin seed routes and verifies projections", () => {
  it("creates only missing accounts, uses stable deposit identities, and verifies funded positions", async () => {
    const accounts = new Set<string>();
    const deposits = new Set<string>();
    const cash = new Map<string, bigint>();
    const shares = new Map<string, bigint>();
    const users = new Map<string, { userId: string; password: string }>();
    const calls: Array<{ url: string; method: string }> = [];
    const fetcher: LoadFetch = async (input, init = {}) => {
      const url = new URL(input);
      const method = init.method ?? "GET";
      calls.push({ url: url.pathname, method });
      const body = init.body ? JSON.parse(String(init.body)) as Record<string, string> : {};
      let result: unknown = {};
      if (url.pathname.endsWith("/auth/login") && method === "POST") {
        const user = users.get(body.username!);
        if (!user || user.password !== body.password) return new Response("invalid credentials", { status: 401 });
        result = { token: `token:${body.username}`, user: { userId: user.userId } };
      } else if (url.pathname.endsWith("/admin/users") && method === "POST") {
        const userId = `user:${body.username}`;
        users.set(body.username!, { userId, password: body.password! });
        result = { userId };
      } else if (url.pathname.endsWith("/admin/accounts") && method === "GET") {
        result = { accounts: [...accounts].map((id) => ({ id })) };
      } else if (url.pathname.endsWith("/admin/accounts") && method === "POST") {
        accounts.add(body.accountId!);
      } else if (url.pathname.endsWith("/deposit") && method === "POST") {
        if (!deposits.has(body.requestId!)) {
          deposits.add(body.requestId!);
          const accountId = decodeURIComponent(url.pathname.split("/").at(-2)!);
          const value = BigInt(body.amount!);
          if (body.asset === "CASH") cash.set(accountId, (cash.get(accountId) ?? 0n) + value);
          else shares.set(`${accountId}:${body.asset!.slice("SHARES:".length)}`, (shares.get(`${accountId}:${body.asset!.slice("SHARES:".length)}`) ?? 0n) + value);
        }
      } else if (url.pathname.endsWith("/balances")) {
        const accountId = decodeURIComponent(url.pathname.split("/").at(-2)!);
        const value = cash.get(accountId) ?? 0n;
        result = { cash: `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`, available: "0.00" };
      } else if (url.pathname.endsWith("/positions")) {
        const accountId = decodeURIComponent(url.pathname.split("/").at(-2)!);
        const value = shares.get(`${accountId}:ACME`) ?? 0n;
        result = value === 0n ? [] : [{ symbol: "ACME", quantity: value.toString() }];
      } else if (url.pathname.endsWith("/system/invariants")) {
        result = { valid: true };
      } else {
        return new Response(`Unexpected request: ${method} ${url.pathname}`, { status: 404 });
      }
      return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
    };
    const config = {
      baseUrl: "http://matchledger.test/api/v1",
      adminToken: "admin-token",
      accountPrefix: "load",
      userPrefix: "load-trader",
      traderPassword: "safe-test-password",
      accountCount: 2,
      cashMinor: "125050",
      holdings: { ACME: "70" },
      fetcher,
      wait: async () => {},
    };

    const first = await seedLoadAccounts(config);
    const second = await seedLoadAccounts(config);

    expect(first.accountIds).toEqual(["load-1", "load-2"]);
    expect(first.traders.map(({ accountId }) => accountId)).toEqual(["load-1", "load-2"]);
    expect(first.balancesVerified).toBe(true);
    expect(second).toEqual(first);
    expect(accounts.size).toBe(2);
    expect(deposits.size).toBe(4);
    expect(cash.get("load-1")).toBe(125050n);
    expect(shares.get("load-1:ACME")).toBe(70n);
    expect(calls.filter((call) => call.url.endsWith("/admin/accounts") && call.method === "POST")).toHaveLength(2);
  });

  it("rejects non-integer money configuration before making requests", async () => {
    let called = false;
    await expect(seedLoadAccounts({
      baseUrl: "http://matchledger.test/api/v1",
      adminToken: "admin-token",
      accountPrefix: "load",
      userPrefix: "load-trader",
      traderPassword: "safe-test-password",
      accountCount: 1,
      cashMinor: "1.25",
      holdings: {},
      fetcher: async () => { called = true; return new Response("{}", { status: 200 }); },
    })).rejects.toThrow("cashMinor must be a positive integer string");
    expect(called).toBe(false);
  });
});

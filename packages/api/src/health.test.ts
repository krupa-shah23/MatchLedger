import { expect, it, vi } from "vitest";
import { buildTestApp } from "./test-helpers.js";

it("public readiness checks the database, reports failure without details, and keeps private routes authenticated", async () => {
  const { app, executor } = await buildTestApp();
  const query = vi.spyOn(executor, "query");
  try {
    const ready = await app.inject({ url: "/healthz" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect(query).toHaveBeenCalledWith("SELECT 1", []);
    expect(ready.headers["cache-control"]).toBe("no-store");
    query.mockRejectedValueOnce(new Error("private database connection detail"));
    const down = await app.inject({ url: "/healthz" });
    expect(down.statusCode).toBe(503);
    expect(down.json()).toEqual({ status: "unavailable" });
    expect((await app.inject({ url: "/system/health" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/orders" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/healthz/private" })).statusCode).toBe(401);
  } finally { await app.close(); }
});

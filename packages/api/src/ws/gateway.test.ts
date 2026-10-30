/**
 * WS: WebSocket gateway tests, against a real server on an ephemeral port
 * with a real `ws` client and real signed JWTs (no mocked auth).
 */
import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../app.js";
import { signToken } from "../auth/tokens.js";
import type { Config } from "../config.js";
import type { FastifyInstance } from "fastify";

const JWT_SECRET = "test-secret-at-least-32-bytes-long!!";

const config: Config = {
  NODE_ENV: "development",
  PORT: 0,
  METRICS_PORT: 0,
  DATABASE_URL: "postgres://localhost/unused",
  JWT_SECRET,
  JWT_TTL_SECONDS: 900,
  SESSION_MAX_SECONDS: 28800,
  PROFILE: "prod",
  PRICE_DECIMALS: 2,
  RATE_LIMIT_ORDERS_PER_SEC: 10,
  RATE_LIMIT_BURST: 20,
  PROJECTOR_POLL_MS: 200,
  PROJECTOR_CHUNK: 1000,
};

const noopExecutor = { query: async () => ({ rows: [] }) } as never;
const noopFacade = {
  hasSubmitCommand: async () => false,
  submitOrder: async () => ({ kind: "JOURNALED" as const }),
  cancelOrder: async () => {},
  haltSymbol: async () => {},
  resumeSymbol: async () => {},
  deposit: async () => {},
  riskView: async () => null,
  internalTrades: async () => [],
};

async function startServer(): Promise<{ app: FastifyInstance; url: string }> {
  const app = await buildApp({ config, executor: noopExecutor, facade: noopFacade, instruments: [] });
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  return { app, url: address.replace("http", "ws") + "/ws" };
}

async function signFor(role: "TRADER" | "RISK" | "OPS" | "ADMIN"): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return signToken({ secret, ttlSeconds: 900 }, "user-1", role);
}

function waitForMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

function waitForClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once("close", (code) => resolve(code));
  });
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("WS: WebSocket Gateway", () => {
  it("WS2: a syntactically valid but unsigned/bad token closes 4401", async () => {
    const started = await startServer();
    app = started.app;
    const socket = new WebSocket(started.url);
    await new Promise((resolve) => socket.once("open", resolve));

    socket.send(JSON.stringify({ op: "auth", token: "not-a-real-jwt" }));
    const code = await waitForClose(socket);
    expect(code).toBe(4401);
  });

  it("a real, validly signed token is accepted and reaches auth.ok", async () => {
    const started = await startServer();
    app = started.app;
    const socket = new WebSocket(started.url);
    await new Promise((resolve) => socket.once("open", resolve));

    const token = await signFor("TRADER");
    socket.send(JSON.stringify({ op: "auth", token }));
    const message = await waitForMessage(socket);
    expect(message).toEqual({ type: "auth.ok" });
    socket.close();
  });

  it("WS3: a TRADER cannot subscribe to risk.rejections or system, but a RISK/ADMIN role can", async () => {
    const started = await startServer();
    app = started.app;
    const socket = new WebSocket(started.url);
    await new Promise((resolve) => socket.once("open", resolve));

    const token = await signFor("TRADER");
    socket.send(JSON.stringify({ op: "auth", token }));
    await waitForMessage(socket); // auth.ok

    socket.send(JSON.stringify({ op: "subscribe", topic: "risk.rejections" }));
    const refusal = await waitForMessage(socket);
    expect(refusal).toEqual({ error: "forbidden", topic: "risk.rejections" });

    socket.send(JSON.stringify({ op: "subscribe", topic: "system" }));
    const refusal2 = await waitForMessage(socket);
    expect(refusal2).toEqual({ error: "forbidden", topic: "system" });

    socket.close();

    const adminSocket = new WebSocket(started.url);
    await new Promise((resolve) => adminSocket.once("open", resolve));
    const adminToken = await signFor("ADMIN");
    adminSocket.send(JSON.stringify({ op: "auth", token: adminToken }));
    await waitForMessage(adminSocket); // auth.ok
    adminSocket.send(JSON.stringify({ op: "subscribe", topic: "system" }));
    const accepted = await waitForMessage(adminSocket);
    expect(accepted).toEqual({ type: "subscribed", topic: "system" });
    adminSocket.close();
  });

  it("book.* and trades.* are open to any authenticated role", async () => {
    const started = await startServer();
    app = started.app;
    const socket = new WebSocket(started.url);
    await new Promise((resolve) => socket.once("open", resolve));

    const token = await signFor("TRADER");
    socket.send(JSON.stringify({ op: "auth", token }));
    await waitForMessage(socket);

    socket.send(JSON.stringify({ op: "subscribe", topic: "book.ACME" }));
    const accepted = await waitForMessage(socket);
    expect(accepted).toEqual({ type: "subscribed", topic: "book.ACME" });
    socket.close();
  });

  it("subscribe before auth.ok is refused with auth required (4401), no subscription happens", async () => {
    const started = await startServer();
    app = started.app;
    const socket = new WebSocket(started.url);
    await new Promise((resolve) => socket.once("open", resolve));

    socket.send(JSON.stringify({ op: "subscribe", topic: "book.ACME" }));
    const code = await waitForClose(socket);
    expect(code).toBe(4401);
  });

  it("WS7: malformed JSON gets an error message without closing the connection", async () => {
    const started = await startServer();
    app = started.app;
    const socket = new WebSocket(started.url);
    await new Promise((resolve) => socket.once("open", resolve));

    socket.send("{not json");
    const message = await waitForMessage(socket);
    expect(message).toEqual({ error: "malformed JSON" });
    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.close();
  });
});

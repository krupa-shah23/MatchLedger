#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import net from "node:net";

const rawBase = process.env.SMOKE_URL;
if (!rawBase) throw new Error("SMOKE_URL must be set to the web application's base URL");

const base = new URL(rawBase);
const basePath = base.pathname.replace(/\/$/, "");
const directApi = new URL(basePath ? `${basePath}/` : "/", base);
const proxyApi = new URL(basePath ? `${basePath}/api/v1/` : "/api/v1/", base);
const timeoutMs = 15_000;
const loginBody = JSON.stringify({ username: "demo-trader", password: "demo-password" });
const apiProbe = await fetch(new URL("system/health", directApi), {
  signal: AbortSignal.timeout(timeoutMs),
});
const api = apiProbe.headers.get("content-type")?.includes("application/json") ? directApi : proxyApi;
const tokenResponse = await fetch(new URL("auth/login", api), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: loginBody,
  signal: AbortSignal.timeout(timeoutMs),
});
if (!tokenResponse.ok) throw new Error(`Demo login failed: HTTP ${tokenResponse.status}`);
const { token } = await tokenResponse.json();
if (typeof token !== "string" || token.length === 0) throw new Error("Login response did not contain a token");
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

const adminLogin = await fetch(new URL("auth/login", api), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "demo-admin", password: "demo-password" }),
  signal: AbortSignal.timeout(timeoutMs),
});
if (!adminLogin.ok) throw new Error(`Demo admin login failed: HTTP ${adminLogin.status}`);
const { token: adminToken } = await adminLogin.json();
const healthResponse = await fetch(new URL("system/health", api), {
  headers: { authorization: `Bearer ${adminToken}` },
  signal: AbortSignal.timeout(timeoutMs),
});
if (!healthResponse.ok) throw new Error(`/system/health failed: HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
if (health.status !== "healthy") throw new Error(`System health is ${String(health.status)}`);
console.log("PASS health: /system/health returned healthy");

const clientOrderId = `smoke-${randomUUID()}`;
const orderResponse = await fetch(new URL("orders", api), {
  method: "POST",
  headers,
  body: JSON.stringify({
    clientOrderId,
    symbol: "ACME",
    side: "BUY",
    type: "LIMIT",
    timeInForce: "IOC",
    quantity: "1",
    price: "50.00",
  }),
  signal: AbortSignal.timeout(timeoutMs),
});
if (orderResponse.status !== 202) throw new Error(`Order submission failed: HTTP ${orderResponse.status}`);
const accepted = await orderResponse.json();
if (typeof accepted.orderId !== "string") throw new Error("Accepted order response omitted orderId");

const terminalStatuses = new Set(["FILLED", "REJECTED", "CANCELED", "CANCELLED", "EXPIRED"]);
const deadline = Date.now() + 30_000;
let terminalOrder;
while (Date.now() < deadline) {
  const response = await fetch(new URL(`orders/${encodeURIComponent(accepted.orderId)}`, api), {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.ok) {
    const order = await response.json();
    if (order.terminal === true || terminalStatuses.has(order.status)) {
      terminalOrder = order;
      break;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!terminalOrder) throw new Error(`Order ${accepted.orderId} did not reach a terminal state within 30 seconds`);
console.log(`PASS order: ${accepted.orderId} reached ${terminalOrder.status}`);

const wsUrl = new URL(basePath ? `${basePath}/ws` : "/ws", base);
wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
const wsMessage = await new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl);
  const timer = setTimeout(() => {
    socket.close();
    reject(new Error("WebSocket did not deliver a book snapshot within 15 seconds"));
  }, timeoutMs);
  let authenticated = false;
  socket.addEventListener("open", () => socket.send(JSON.stringify({ op: "auth", token })));
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.type === "auth.ok" && !authenticated) {
      authenticated = true;
      socket.send(JSON.stringify({ op: "subscribe", topic: "book.ACME" }));
    } else if (message.type === "snapshot" && message.topic === "book.ACME") {
      clearTimeout(timer);
      socket.close();
      resolve(message);
    } else if (message.error) {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`WebSocket error: ${message.error}`));
    }
  });
  socket.addEventListener("error", () => {
    clearTimeout(timer);
    reject(new Error(`WebSocket connection failed: ${wsUrl.origin}${wsUrl.pathname}`));
  });
  socket.addEventListener("close", (event) => {
    if (!event.wasClean && !authenticated) {
      clearTimeout(timer);
      reject(new Error(`WebSocket closed before authentication: ${event.code}`));
    }
  });
});
if (wsMessage.topic !== "book.ACME") throw new Error("WebSocket returned an unexpected topic");
console.log("PASS websocket: authenticated subscription received book.ACME snapshot");

const targetHost = base.hostname;
const privatePorts = [
  ["Postgres", 5432],
  ["Kafka", 29092],
  ["Prometheus", 9090],
  ["API metrics", 3001],
  ["shard metrics", 9101],
];
const reachable = await Promise.all(privatePorts.map(([name, port]) => new Promise((resolve) => {
  const socket = net.createConnection({ host: targetHost, port });
  const finish = (isReachable) => {
    socket.destroy();
    resolve({ name, port, isReachable });
  };
  socket.setTimeout(1500, () => finish(false));
  socket.once("connect", () => finish(true));
  socket.once("error", () => finish(false));
})));
const exposed = reachable.filter((result) => result.isReachable);
if (exposed.length > 0) {
  throw new Error(`Private service ports reachable from the smoke host (${targetHost}): ${exposed.map(({ name, port }) => `${name}:${port}`).join(", ")}`);
}
console.log(`PASS private ports: Postgres, Kafka, Prometheus, and metrics ports are unreachable at ${targetHost}`);

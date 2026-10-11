import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as jose from "jose";
import WebSocket from "ws";
import { buildServer } from "./index.js";

const SECRET_STR = "test-secret-key-12345678901234567890";
const SECRET_BYTES = new TextEncoder().encode(SECRET_STR);

async function createToken(expiration?: string) {
  const jwt = new jose.SignJWT({ sub: "user-123" })
    .setProtectedHeader({ alg: "HS256" });
  if (expiration) {
    jwt.setExpirationTime(expiration);
  }
  return await jwt.sign(SECRET_BYTES);
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      ws.off("open", onOpen);
      ws.off("error", onError);
      ws.off("close", onClose);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("WebSocket closed before open"));
    };

    ws.on("open", onOpen);
    ws.on("error", onError);
    ws.on("close", onClose);
  });
}

function waitForAuthAck(ws: WebSocket): Promise<{ op: string; status: string }> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
    };
    const onMessage = (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.op === "auth" && message.status === "ok") {
          cleanup();
          resolve(message);
        }
      } catch {
        // ignore non-JSON frames until the auth ack arrives
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("WebSocket closed before auth acknowledgement"));
    };

    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
  });
}

describe("Spike 5: Fastify, JWT, WebSocket auth", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let address: string;
  const sockets = new Set<WebSocket>();

  beforeAll(async () => {
    app = await buildServer({ jwtSecret: SECRET_STR, wsAuthTimeoutMs: 1000 });
    address = await app.listen({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    sockets.clear();
  });

  afterAll(async () => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    }
    await app.close();
  });

  it("returns 200 for GET /health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("passes with a valid JWT on /protected", async () => {
    const token = await createToken("1h");
    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("authenticated");
  });

  it("returns 401 for expired token on /protected", async () => {
    const token = await createToken("-1s");
    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for missing token on /protected", async () => {
    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
  });

  it("closes WebSocket client after timeout if no auth is sent", async () => {
    const wsUrl = address.replace("http://", "ws://") + "/ws";
    const ws = new WebSocket(wsUrl);
    sockets.add(ws);

    const closed = new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });

    const code = await closed;
    expect(code).toBe(4001);
  });

  it("acknowledges WebSocket client with a valid token", async () => {
    const wsUrl = address.replace("http://", "ws://") + "/ws";
    const ws = new WebSocket(wsUrl);
    sockets.add(ws);
    const token = await createToken("1h");

    await waitForOpen(ws);
    const ackPromise = waitForAuthAck(ws);
    ws.send(JSON.stringify({ op: "auth", token }));

    const reply = await ackPromise;
    expect(reply).toEqual({ op: "auth", status: "ok" });
    ws.close();
  });
});

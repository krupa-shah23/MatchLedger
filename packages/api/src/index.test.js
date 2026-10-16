import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import * as jose from "jose";
import WebSocket from "ws";
import { buildServer } from "./index.js";
const SECRET_STR = "test-secret-key-12345678901234567890";
const SECRET_BYTES = new TextEncoder().encode(SECRET_STR);
async function createToken(expiration) {
    const jwt = new jose.SignJWT({ sub: "user-123" })
        .setProtectedHeader({ alg: "HS256" });
    if (expiration) {
        jwt.setExpirationTime(expiration);
    }
    return await jwt.sign(SECRET_BYTES);
}
function waitForOpen(ws) {
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
        const onError = (error) => {
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
function waitForAuthAck(ws) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            ws.off("message", onMessage);
            ws.off("error", onError);
            ws.off("close", onClose);
        };
        const onMessage = (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.op === "auth" && message.status === "ok") {
                    cleanup();
                    resolve(message);
                }
            }
            catch {
                // ignore non-JSON frames until the auth ack arrives
            }
        };
        const onError = (error) => {
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
    let app;
    let address;
    const sockets = new Set();
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
        const closed = new Promise((resolve) => {
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
describe("Week 9: API endpoints", () => {
    let app;
    let traderToken;
    let riskToken;
    let adminToken;
    beforeAll(async () => {
        app = await buildServer({ jwtSecret: SECRET_STR });
        const traderJwt = new jose.SignJWT({ userId: "u1", username: "trader1", role: "TRADER", accountIds: ["acc1"] })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h");
        traderToken = await traderJwt.sign(SECRET_BYTES);
        const riskJwt = new jose.SignJWT({ userId: "u2", username: "risk1", role: "RISK", accountIds: [] })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h");
        riskToken = await riskJwt.sign(SECRET_BYTES);
        const adminJwt = new jose.SignJWT({ userId: "u4", username: "admin1", role: "ADMIN", accountIds: [] })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h");
        adminToken = await adminJwt.sign(SECRET_BYTES);
    });
    afterAll(async () => {
        await app.close();
    });
    it("POST /api/v1/auth/login returns a token", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { username: "trader1", password: "any-password" },
        });
        expect(res.statusCode).toBe(200);
        const { token, user } = res.json();
        expect(token).toBeTruthy();
        expect(user.role).toBe("TRADER");
    });
    it("GET /api/v1/me returns authenticated user", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: `Bearer ${traderToken}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().role).toBe("TRADER");
    });
    it("POST /api/v1/orders returns 202 and orderId", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/orders",
            headers: { authorization: `Bearer ${traderToken}` },
            payload: { clientOrderId: "c1", symbol: "ACME", side: "BUY", type: "LIMIT", timeInForce: "GTC", quantity: 100, price: "100.00" },
        });
        expect(res.statusCode).toBe(202);
        const { orderId, status } = res.json();
        expect(orderId).toBeTruthy();
        expect(status).toBe("RECEIVED");
    });
    it("GET /api/v1/orders/{id} returns order", async () => {
        const postRes = await app.inject({
            method: "POST",
            url: "/api/v1/orders",
            headers: { authorization: `Bearer ${traderToken}` },
            payload: { clientOrderId: "c2", symbol: "ACME", side: "BUY", type: "LIMIT", timeInForce: "GTC", quantity: 100 },
        });
        const { orderId } = postRes.json();
        const getRes = await app.inject({
            method: "GET",
            url: `/api/v1/orders/${orderId}`,
            headers: { authorization: `Bearer ${traderToken}` },
        });
        expect(getRes.statusCode).toBe(200);
        expect(getRes.json().orderId).toBe(orderId);
    });
    it("GET /api/v1/orders returns list", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/orders",
            headers: { authorization: `Bearer ${traderToken}` },
        });
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
    });
    it("GET /api/v1/instruments returns list", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/instruments",
        });
        expect(res.statusCode).toBe(200);
        const items = res.json();
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].symbol).toBeTruthy();
    });
    it("GET /api/v1/symbols/{symbol}/book returns order book", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/symbols/ACME/book?depth=10",
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().symbol).toBe("ACME");
        expect(Array.isArray(res.json().bids)).toBe(true);
    });
    it("GET /api/v1/accounts/{id}/balances requires auth", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/accounts/acc1/balances",
        });
        expect(res.statusCode).toBe(401);
    });
    it("GET /api/v1/accounts/{id}/balances returns balances", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/accounts/acc1/balances",
            headers: { authorization: `Bearer ${traderToken}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().total).toBeTruthy();
    });
    it("GET /api/v1/risk/breakers requires RISK role", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/risk/breakers",
            headers: { authorization: `Bearer ${traderToken}` },
        });
        expect(res.statusCode).toBe(403);
    });
    it("GET /api/v1/risk/breakers allowed for RISK role", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/risk/breakers",
            headers: { authorization: `Bearer ${riskToken}` },
        });
        expect(res.statusCode).toBe(200);
    });
    it("GET /api/v1/system/metrics/summary requires ADMIN", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/system/metrics/summary",
            headers: { authorization: `Bearer ${traderToken}` },
        });
        expect(res.statusCode).toBe(403);
    });
    it("GET /api/v1/system/metrics/summary allowed for ADMIN", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/system/metrics/summary",
            headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(200);
    });
});

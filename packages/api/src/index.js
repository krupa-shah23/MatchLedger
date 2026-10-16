import Fastify, {} from "fastify";
import websocketPlugin from "@fastify/websocket";
import * as jose from "jose";
// Demo users
const DEMO_USERS = new Map([
    ["trader1", { id: "u1", role: "TRADER", accountIds: ["acc1"] }],
    ["risk1", { id: "u2", role: "RISK", accountIds: [] }],
    ["ops1", { id: "u3", role: "OPS", accountIds: [] }],
    ["admin1", { id: "u4", role: "ADMIN", accountIds: [] }],
]);
// In-memory state for demo
const orders = new Map();
const accounts = new Map();
const positions = new Map();
// Initialize demo data
accounts.set("acc1", {
    id: "acc1",
    owner: "trader1",
    cash: 100000n,
    heldCash: 0n,
});
export async function buildServer(opts = {}) {
    const jwtSecretStr = opts.jwtSecret ?? process.env.JWT_SECRET ?? "default-secret-key-12345678901234567890";
    const secretBytes = new TextEncoder().encode(jwtSecretStr);
    const wsTimeout = opts.wsAuthTimeoutMs ?? 5000;
    const app = Fastify({ logger: false });
    await app.register(websocketPlugin);
    // Auth: extract user from JWT
    const extractUser = async (request) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new Error("Missing or invalid authorization header");
        }
        const token = authHeader.substring(7);
        const { payload } = await jose.jwtVerify(token, secretBytes, { algorithms: ["HS256"] });
        return payload;
    };
    // Health
    app.get("/health", async () => {
        return { status: "ok" };
    });
    app.get("/protected", async (request, reply) => {
        try {
            const user = await extractUser(request);
            return reply.code(200).send({ status: "authenticated", payload: user });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ Auth endpoints ============
    app.post("/api/v1/auth/login", async (request, reply) => {
        const { username, password } = request.body;
        const user = DEMO_USERS.get(username);
        if (!user) {
            return reply.code(401).send({ error: "Invalid credentials" });
        }
        const token = await new jose.SignJWT({ userId: user.id, username, role: user.role, accountIds: user.accountIds })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("24h")
            .sign(secretBytes);
        return reply.code(200).send({ token, user });
    });
    app.get("/api/v1/me", async (request, reply) => {
        try {
            const user = await extractUser(request);
            return reply.code(200).send(user);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ Orders endpoints (tier 1) ============
    app.post("/api/v1/orders", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (user.role !== "TRADER") {
                return reply.code(403).send({ error: "Forbidden" });
            }
            const { clientOrderId, symbol, side, type, timeInForce, quantity, price } = request.body;
            const orderId = `ord-${Math.random().toString(36).substr(2, 9)}`;
            orders.set(orderId, {
                orderId,
                clientOrderId,
                accountId: user.accountIds[0],
                symbol,
                side,
                type,
                timeInForce,
                quantity,
                price: price ?? "0",
                status: "RECEIVED",
                filledQty: 0,
                createdAt: new Date().toISOString(),
            });
            return reply.code(202).send({ orderId, status: "RECEIVED" });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/orders/:id", async (request, reply) => {
        try {
            const user = await extractUser(request);
            const { id } = request.params;
            const order = orders.get(id);
            if (!order) {
                return reply.code(404).send({ error: "Not found" });
            }
            if (user.role === "TRADER" && !user.accountIds.includes(order.accountId)) {
                return reply.code(404).send({ error: "Not found" });
            }
            return reply.code(200).send(order);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/orders", async (request, reply) => {
        try {
            const user = await extractUser(request);
            let result = Array.from(orders.values());
            if (user.role === "TRADER") {
                result = result.filter((o) => user.accountIds.includes(o.accountId));
            }
            return reply.code(200).send(result);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.delete("/api/v1/orders/:id", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (user.role !== "TRADER") {
                return reply.code(403).send({ error: "Forbidden" });
            }
            const { id } = request.params;
            const order = orders.get(id);
            if (!order) {
                return reply.code(404).send({ error: "Not found" });
            }
            if (!user.accountIds.includes(order.accountId)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            order.status = "CANCELLED";
            return reply.code(202).send({ status: "CANCEL_REQUESTED" });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/orders/:id/events", async (request, reply) => {
        try {
            const user = await extractUser(request);
            const { id } = request.params;
            const order = orders.get(id);
            if (!order) {
                return reply.code(404).send({ error: "Not found" });
            }
            if (user.role === "TRADER" && !user.accountIds.includes(order.accountId)) {
                return reply.code(404).send({ error: "Not found" });
            }
            // Return a mock event timeline
            return reply.code(200).send([
                { seq: 1, type: "OrderSubmitted", ts: order.createdAt, payload: order },
                { seq: 2, type: "OrderAccepted", ts: new Date().toISOString(), payload: { orderId: id } },
            ]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ Market data endpoints (tier 1) ============
    app.get("/api/v1/instruments", async (request, reply) => {
        return reply.code(200).send([
            { symbol: "ACME", tickSize: "0.01", lotSize: 1, status: "ACTIVE" },
            { symbol: "BOBO", tickSize: "0.01", lotSize: 1, status: "ACTIVE" },
        ]);
    });
    app.get("/api/v1/instruments/:symbol", async (request, reply) => {
        const { symbol } = request.params;
        return reply.code(200).send({ symbol, tickSize: "0.01", lotSize: 1, status: "ACTIVE" });
    });
    app.get("/api/v1/symbols/:symbol/book", async (request, reply) => {
        const { symbol } = request.params;
        const depth = parseInt(request.query.depth ?? "10");
        return reply.code(200).send({
            symbol,
            seq: 1,
            bids: [{ price: "100.00", qty: 100 }],
            asks: [{ price: "100.50", qty: 100 }],
            depth,
        });
    });
    app.get("/api/v1/symbols/:symbol/trades", async (request, reply) => {
        const { symbol } = request.params;
        return reply.code(200).send([]);
    });
    app.get("/api/v1/symbols/:symbol/status", async (request, reply) => {
        const { symbol } = request.params;
        return reply.code(200).send({
            symbol,
            breaker: { state: "CLOSED", reason: null, incidentStart: null },
        });
    });
    // ============ Accounts endpoints (tier 1) ============
    app.get("/api/v1/accounts/:id/balances", async (request, reply) => {
        try {
            const user = await extractUser(request);
            const { id } = request.params;
            const account = accounts.get(id);
            if (!account) {
                return reply.code(404).send({ error: "Not found" });
            }
            if (user.role === "TRADER" && !user.accountIds.includes(id)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send({
                total: "100000.00",
                held: "0.00",
                available: "100000.00",
            });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/accounts/:id/positions", async (request, reply) => {
        try {
            const user = await extractUser(request);
            const { id } = request.params;
            if (user.role === "TRADER" && !user.accountIds.includes(id)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/accounts/:id/pnl", async (request, reply) => {
        try {
            const user = await extractUser(request);
            const { id } = request.params;
            if (user.role === "TRADER" && !user.accountIds.includes(id)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send({ realized: "0.00", unrealized: "0.00" });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/accounts/:id/reservations", async (request, reply) => {
        try {
            const user = await extractUser(request);
            const { id } = request.params;
            if (user.role === "TRADER" && !user.accountIds.includes(id)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ Risk endpoints (tier 2) ============
    app.get("/api/v1/risk/rejections", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (!["RISK", "ADMIN"].includes(user.role)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/risk/breakers", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (!["RISK", "ADMIN"].includes(user.role)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([
                { symbol: "ACME", state: "CLOSED", reason: null, incidentStart: null, maxDuration: 3600000 },
            ]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ Reconciliation endpoints (tier 2) ============
    app.post("/api/v1/recon/runs", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (user.role !== "OPS") {
                return reply.code(403).send({ error: "Forbidden" });
            }
            const runId = `run-${Math.random().toString(36).substr(2, 9)}`;
            return reply.code(202).send({ runId, status: "PROCESSING" });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/recon/runs", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (!["OPS", "ADMIN"].includes(user.role)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/recon/breaks", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (!["OPS", "ADMIN"].includes(user.role)) {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ System endpoints (admin only) ============
    app.get("/api/v1/system/metrics/summary", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (user.role !== "ADMIN") {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send({
                throughput: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                eventLoopLag: 0,
            });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/system/shards", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (user.role !== "ADMIN") {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send([]);
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    app.get("/api/v1/system/invariants", async (request, reply) => {
        try {
            const user = await extractUser(request);
            if (user.role !== "ADMIN") {
                return reply.code(403).send({ error: "Forbidden" });
            }
            return reply.code(200).send({
                debitsEqualCredits: true,
                positionsSumToZero: true,
                noNegativeAvailable: true,
            });
        }
        catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
    // ============ WebSocket ============
    app.get("/ws", { websocket: true }, (socket) => {
        let authenticated = false;
        let userId = "";
        const timer = setTimeout(() => {
            if (!authenticated) {
                socket.close(4001, "Auth timeout");
            }
        }, wsTimeout);
        socket.on("message", async (rawMessage) => {
            try {
                const msg = JSON.parse(rawMessage.toString());
                if (msg.op === "auth" && typeof msg.token === "string") {
                    try {
                        const { payload } = await jose.jwtVerify(msg.token, secretBytes, { algorithms: ["HS256"] });
                        userId = payload.userId ?? "";
                        authenticated = true;
                        clearTimeout(timer);
                        socket.send(JSON.stringify({ op: "auth", status: "ok" }));
                    }
                    catch {
                        socket.close(4001, "Invalid token");
                    }
                }
                else if (authenticated && msg.op === "subscribe") {
                    socket.send(JSON.stringify({ op: "subscribed", topic: msg.topic, status: "ok" }));
                }
                else if (authenticated && msg.op === "unsubscribe") {
                    socket.send(JSON.stringify({ op: "unsubscribed", topic: msg.topic, status: "ok" }));
                }
                else if (!authenticated) {
                    socket.close(4000, "Not authenticated");
                }
            }
            catch {
                socket.close(4000, "Invalid JSON");
            }
        });
        socket.on("close", () => {
            clearTimeout(timer);
        });
    });
    await app.ready();
    return app;
}

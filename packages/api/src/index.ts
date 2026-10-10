import Fastify, { type FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import * as jose from "jose";

export interface ServerOptions {
  jwtSecret?: string;
  wsAuthTimeoutMs?: number;
}

export async function buildServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  const jwtSecretStr = opts.jwtSecret ?? process.env.JWT_SECRET ?? "default-secret-key-12345678901234567890";
  const secretBytes = new TextEncoder().encode(jwtSecretStr);
  const wsTimeout = opts.wsAuthTimeoutMs ?? 5000;

  const app = Fastify({ logger: false });
  await app.register(websocketPlugin);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/protected", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.substring(7);
    try {
      const { payload } = await jose.jwtVerify(token, secretBytes, { algorithms: ["HS256"] });
      return reply.code(200).send({ status: "authenticated", payload });
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
  });

  app.get("/ws", { websocket: true }, (socket) => {
    let authenticated = false;

    const timer = setTimeout(() => {
      if (!authenticated) {
        socket.close(4001, "Auth timeout");
      }
    }, wsTimeout);

    socket.on("message", async (rawMessage: Buffer) => {
      try {
        const msg = JSON.parse(rawMessage.toString());
        if (msg.op === "auth" && typeof msg.token === "string") {
          try {
            await jose.jwtVerify(msg.token, secretBytes, { algorithms: ["HS256"] });
            authenticated = true;
            clearTimeout(timer);
            socket.send(JSON.stringify({ op: "auth", status: "ok" }));
          } catch {
            socket.close(4001, "Invalid token");
          }
        }
      } catch {
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

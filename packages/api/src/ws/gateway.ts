/**
 * WebSocket gateway: @fastify/websocket integration
 * Auth timer, per-topic role checks, ping/pong, graceful shutdown
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import type { ApiRole } from "@matchledger/common";
import { Hub } from "./hub.js";
import { verifyToken } from "../auth/tokens.js";
import type { Config } from "../config.js";

export interface GatewayDeps {
  hub: Hub;
  config: Config;
}

interface AuthMessage {
  op: string;
  token: string;
}

interface ClientMessage {
  op: string;
  topic?: string;
}

/**
 * Topics not safe for every authenticated role to read. Anything not
 * listed (book.*, trades.*, breaker, user.*) is open to any authenticated
 * connection; user.* is scoped to the connection's own account on the
 * hub's publish side, not by a role check here.
 */
function topicAllowedForRole(topic: string, role: ApiRole): boolean {
  if (topic === "risk.rejections") return role === "RISK" || role === "ADMIN";
  if (topic === "system") return role === "ADMIN";
  return true;
}

export async function registerWebSocketGateway(app: FastifyInstance, deps: GatewayDeps): Promise<void> {
  const hub = deps.hub;

  app.get("/ws", { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    // 1. Auth timer: 5 seconds to send auth message
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let authenticated = false;
    let role: ApiRole | undefined;

    const startAuthTimer = () => {
      authTimer = setTimeout(() => {
        socket.close(4401, "auth timeout");
      }, 5000);
    };

    const clearAuthTimer = () => {
      if (authTimer) clearTimeout(authTimer);
    };

    // 2. Ping/pong for keep-alive
    let missedPongs = 0;
    const pingTimer = setInterval(() => {
      if (missedPongs >= 2) {
        socket.close(1000, "missed pongs");
        clearInterval(pingTimer);
        return;
      }
      missedPongs++;
      socket.ping();
    }, 20000); // Every 20 seconds

    socket.on("pong", () => {
      missedPongs = 0;
    });

    // 3. Message handling
    socket.on("message", (data: Buffer) => {
      const message = (() => {
        try {
          return JSON.parse(data.toString());
        } catch {
          socket.send(JSON.stringify({ error: "malformed JSON" }));
          return null;
        }
      })();

      if (!message) return;

      // Auth message
      if (!authenticated) {
        if (message.op !== "auth") {
          socket.close(4401, "auth required");
          return;
        }
        if (!message.token || typeof message.token !== "string") {
          socket.close(4401, "invalid token");
          return;
        }

        const secret = new TextEncoder().encode(deps.config.JWT_SECRET);
        verifyToken({ secret, ttlSeconds: deps.config.JWT_TTL_SECONDS }, message.token)
          .then((claims) => {
            role = claims.role;
            authenticated = true;
            clearAuthTimer();
            socket.send(JSON.stringify({ type: "auth.ok" }));
          })
          .catch(() => {
            socket.close(4401, "invalid token");
          });
        return;
      }

      // Subscribe
      if (message.op === "subscribe") {
        const topic = message.topic;
        if (!topic || typeof topic !== "string") {
          socket.send(JSON.stringify({ error: "invalid topic" }));
          return;
        }
        if (!role || !topicAllowedForRole(topic, role)) {
          socket.send(JSON.stringify({ error: "forbidden", topic }));
          return;
        }
        hub.subscribe(socket as any, topic);
        socket.send(JSON.stringify({ type: "subscribed", topic }));
        return;
      }

      // Unsubscribe
      if (message.op === "unsubscribe") {
        const topic = message.topic;
        if (!topic || typeof topic !== "string") {
          socket.send(JSON.stringify({ error: "invalid topic" }));
          return;
        }
        hub.unsubscribe(socket as any, topic);
        socket.send(JSON.stringify({ type: "unsubscribed", topic }));
        return;
      }
    });

    // 4. Connection cleanup
    socket.on("close", () => {
      clearAuthTimer();
      clearInterval(pingTimer);
      // Unsubscribe from all topics
      hub.closeConnection(socket as any);
    });

    startAuthTimer();
  });
}

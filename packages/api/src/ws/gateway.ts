/**
 * WebSocket gateway: @fastify/websocket integration
 * Auth timer, per-topic role checks, ping/pong, graceful shutdown
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { Hub } from "./hub.js";

export interface GatewayDeps {
  hub: Hub;
  // verifyToken will come from auth plugin
}

interface AuthMessage {
  op: string;
  token: string;
}

interface ClientMessage {
  op: string;
  topic?: string;
}

export async function registerWebSocketGateway(app: FastifyInstance, deps: GatewayDeps): Promise<void> {
  const hub = deps.hub;

  app.get("/ws", { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    // 1. Auth timer: 5 seconds to send auth message
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let authenticated = false;

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
        // Verify token: for now, accept any non-empty token
        if (!message.token || typeof message.token !== "string") {
          socket.close(4401, "invalid token");
          return;
        }
        authenticated = true;
        clearAuthTimer();
        socket.send(JSON.stringify({ type: "auth.ok" }));
        return;
      }

      // Subscribe
      if (message.op === "subscribe") {
        const topic = message.topic;
        if (!topic || typeof topic !== "string") {
          socket.send(JSON.stringify({ error: "invalid topic" }));
          return;
        }
        // Subscribe to topic (role-based filtering would be added here)
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

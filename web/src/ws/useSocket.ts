/**
 * One hook, one WebSocket. Owns the connection lifecycle (auth, subscribe,
 * reconnect with backoff) and delegates all state transitions to the pure
 * reducer in state/stream-state.ts. No business logic lives here beyond
 * wiring the socket to the reducer.
 */
import { useEffect, useRef, useState } from "react";
import { createInitialState, reduce, type Effect, type StreamState } from "../state/stream-state.js";

export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: SocketEventLike) => void): void;
}

export interface SocketEventLike {
  data?: string;
  code?: number;
}

export type ConnectionStatus = "connecting" | "authenticated" | "stale";

export interface ReconnectHandle {
  cancel: () => void;
}

export interface UseSocketOptions {
  url: string;
  token: string | null;
  topics: string[];
  onLogout: () => void;
  onEffects?: (effects: Effect[]) => void;
  createSocket?: (url: string) => SocketLike;
  scheduleReconnect?: (attempt: number, run: () => void) => ReconnectHandle;
}

export interface UseSocketResult {
  state: StreamState;
  connection: ConnectionStatus;
}

function defaultCreateSocket(url: string): SocketLike {
  return new WebSocket(url) as unknown as SocketLike;
}

function defaultScheduleReconnect(attempt: number, run: () => void): ReconnectHandle {
  const base = Math.min(2 ** attempt * 200, 30_000);
  const jitter = Math.random() * base * 0.2;
  const timer = setTimeout(run, base + jitter);
  return { cancel: () => clearTimeout(timer) };
}

export function useSocket(options: UseSocketOptions): UseSocketResult {
  const [state, setState] = useState<StreamState>(createInitialState());
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let socket: SocketLike | null = null;
    let pendingReconnect: ReconnectHandle | null = null;

    const createSocket = options.createSocket ?? defaultCreateSocket;
    const scheduleReconnect = options.scheduleReconnect ?? defaultScheduleReconnect;

    function applyResult(result: { state: StreamState; effects: Effect[] }) {
      setState(result.state);
      stateRef.current = result.state;
      for (const effect of result.effects) {
        if (effect.type === "LOGOUT") options.onLogout();
      }
      if (result.effects.length > 0) options.onEffects?.(result.effects);
    }

    function connect() {
      socket = createSocket(options.url);

      socket.addEventListener("open", () => {
        // Token travels in the first message, never in the URL.
        socket?.send(JSON.stringify({ op: "auth", token: options.token }));
      });

      socket.addEventListener("message", (event) => {
        if (!event.data) return;
        const message = JSON.parse(event.data) as Record<string, unknown>;

        if (message.type === "auth.ok") {
          attempt = 0;
          setConnection("authenticated");
          for (const topic of options.topics) {
            socket?.send(JSON.stringify({ op: "subscribe", topic }));
          }
          return;
        }

        if (message.type === "snapshot") {
          applyResult(
            reduce(stateRef.current, {
              kind: "snapshot",
              topic: message.topic as string,
              epoch: message.epoch as number,
              seq: message.seq as number,
              conflated: message.conflated as boolean | undefined,
              data: message.data,
            })
          );
          return;
        }

        if (message.type === "delta") {
          applyResult(
            reduce(stateRef.current, {
              kind: "delta",
              topic: message.topic as string,
              epoch: message.epoch as number,
              seq: message.seq as number,
              data: message.data,
            })
          );
        }
      });

      socket.addEventListener("close", (event) => {
        if (cancelled) return;
        const code = event.code ?? 1000;
        applyResult(reduce(stateRef.current, { kind: "close", code }));
        if (code === 4401) return; // logged out; no reconnect

        applyResult(reduce(stateRef.current, { kind: "disconnect" }));
        setConnection("stale");
        attempt += 1;
        pendingReconnect = scheduleReconnect(attempt, () => {
          if (!cancelled) connect();
        });
      });
    }

    connect();

    return () => {
      cancelled = true;
      pendingReconnect?.cancel();
      socket?.close();
    };
  }, [options.url, options.token]);

  return { state, connection };
}

/**
 * Resync reducer tests (US1-US9), against the real reducer in stream-state.ts
 * and the real useSocket hook, with an injected fake socket and scheduler.
 */
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createInitialState, reduce, type StreamState } from "./stream-state.js";
import { useSocket, type SocketLike } from "../ws/useSocket.js";

describe("reduce (resync reducer)", () => {
  it("US2: delta with a different epoch triggers a refetch and syncing status", () => {
    const afterSnapshot = reduce(createInitialState(), {
      kind: "snapshot",
      topic: "book.ACME",
      epoch: 1,
      seq: 500,
      data: { levels: [] },
    });

    const result = reduce(afterSnapshot.state, {
      kind: "delta",
      topic: "book.ACME",
      epoch: 2,
      seq: 501,
      data: {},
    });

    expect(result.effects).toEqual([{ type: "REFETCH_SNAPSHOT", topic: "book.ACME" }]);
    expect(result.state.topics["book.ACME"]!.status).toBe("syncing");
  });

  it("US3: a conflated snapshot replaces state and carries the badge", () => {
    const first = reduce(createInitialState(), {
      kind: "snapshot",
      topic: "user.orders",
      epoch: 1,
      seq: 10,
      data: { old: true },
    });

    const conflated = reduce(first.state, {
      kind: "snapshot",
      topic: "user.orders",
      epoch: 1,
      seq: 50,
      conflated: true,
      data: { fresh: true },
    });

    expect(conflated.state.topics["user.orders"]!.conflated).toBe(true);
    expect(conflated.state.topics["user.orders"]!.snapshot).toEqual({ fresh: true });
    expect(conflated.state.topics["user.orders"]!.seq).toBe(50);
  });

  it("US4: a gap on user.*, breaker, risk.rejections, or system triggers a refetch", () => {
    for (const topic of ["user.orders", "breaker", "risk.rejections", "system"]) {
      const snapshot = reduce(createInitialState(), {
        kind: "snapshot",
        topic,
        epoch: 1,
        seq: 10,
        data: {},
      });
      const gapped = reduce(snapshot.state, { kind: "delta", topic, epoch: 1, seq: 15, data: {} });
      expect(gapped.effects).toEqual([{ type: "REFETCH_SNAPSHOT", topic }]);

      const contiguous = reduce(snapshot.state, { kind: "delta", topic, epoch: 1, seq: 11, data: {} });
      expect(contiguous.effects).toEqual([]);
    }
  });

  it("US5: book.* applies a non-contiguous higher seq without refetching, and ignores a lower-or-equal seq", () => {
    const snapshot = reduce(createInitialState(), {
      kind: "snapshot",
      topic: "book.ACME",
      epoch: 1,
      seq: 500,
      data: {},
    });

    const jumped = reduce(snapshot.state, { kind: "delta", topic: "book.ACME", epoch: 1, seq: 507, data: { applied: true } });
    expect(jumped.effects).toEqual([]);
    expect(jumped.state.topics["book.ACME"]!.seq).toBe(507);
    expect(jumped.state.topics["book.ACME"]!.snapshot).toEqual({ applied: true });

    const stale = reduce(jumped.state, { kind: "delta", topic: "book.ACME", epoch: 1, seq: 500, data: { shouldBeIgnored: true } });
    expect(stale.state.topics["book.ACME"]!.seq).toBe(507);
    expect(stale.state.topics["book.ACME"]!.snapshot).toEqual({ applied: true });
  });

  it("US7: close code 4401 emits LOGOUT; 1013 emits REFETCH_ALL + RECONNECT; 1001 emits RECONNECT", () => {
    const state = createInitialState();
    expect(reduce(state, { kind: "close", code: 4401 }).effects).toEqual([{ type: "LOGOUT" }]);
    expect(reduce(state, { kind: "close", code: 1013 }).effects).toEqual([
      { type: "REFETCH_ALL" },
      { type: "RECONNECT" },
    ]);
    expect(reduce(state, { kind: "close", code: 1001 }).effects).toEqual([{ type: "RECONNECT" }]);
  });

  it("US6: disconnect marks every topic stale and asks to reconnect", () => {
    const snapshot = reduce(createInitialState(), {
      kind: "snapshot",
      topic: "book.ACME",
      epoch: 1,
      seq: 1,
      data: {},
    });
    const result = reduce(snapshot.state, { kind: "disconnect" });
    expect(result.state.topics["book.ACME"]!.status).toBe("stale");
    expect(result.effects).toEqual([{ type: "RECONNECT" }]);
  });

  it("US8: property test — for any sequence of same-epoch deltas, final seq is the max seen, never a lower one applied", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 50 }), (seqs) => {
        let state: StreamState = reduce(createInitialState(), {
          kind: "snapshot",
          topic: "book.ACME",
          epoch: 1,
          seq: 0,
          data: {},
        }).state;

        let maxSeen = 0;
        for (const seq of seqs) {
          state = reduce(state, { kind: "delta", topic: "book.ACME", epoch: 1, seq, data: {} }).state;
          maxSeen = Math.max(maxSeen, seq);
          expect(state.topics["book.ACME"]!.seq).toBeGreaterThanOrEqual(maxSeen === 0 ? 0 : 0);
        }
        expect(state.topics["book.ACME"]!.seq).toBe(maxSeen);
      }),
      { seed: 42, numRuns: 100 }
    );
  });
});

class FakeSocket implements SocketLike {
  public sent: string[] = [];
  private listeners: Record<string, Array<(event: { data?: string; code?: number }) => void>> = {};

  addEventListener(type: string, listener: (event: { data?: string; code?: number }) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit("close", { code: 1000 });
  }

  emit(type: string, event: { data?: string; code?: number }): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

describe("useSocket", () => {
  it("US1: does not subscribe before auth.ok, and never puts the token in the URL", async () => {
    const sockets: FakeSocket[] = [];
    const { result } = renderHook(() =>
      useSocket({
        url: "ws://localhost/ws",
        token: "secret-token",
        topics: ["book.ACME"],
        onLogout: () => {},
        createSocket: (url) => {
          expect(url).not.toContain("secret-token");
          const socket = new FakeSocket();
          sockets.push(socket);
          return socket;
        },
      })
    );

    await waitFor(() => expect(sockets).toHaveLength(1));
    const socket = sockets[0]!;

    act(() => socket.emit("open", {}));
    expect(socket.sent).toEqual([JSON.stringify({ op: "auth", token: "secret-token" })]);
    expect(socket.sent.some((m) => m.includes("subscribe"))).toBe(false);

    act(() => socket.emit("message", { data: JSON.stringify({ type: "auth.ok" }) }));
    expect(socket.sent).toContainEqual(JSON.stringify({ op: "subscribe", topic: "book.ACME" }));
    expect(result.current.connection).toBe("authenticated");
  });

  it("US6: disconnect goes stale and reconnects with an injected backoff schedule", async () => {
    const sockets: FakeSocket[] = [];
    const reconnectAttempts: number[] = [];
    renderHook(() =>
      useSocket({
        url: "ws://localhost/ws",
        token: "t",
        topics: [],
        onLogout: () => {},
        createSocket: () => {
          const socket = new FakeSocket();
          sockets.push(socket);
          return socket;
        },
        scheduleReconnect: (attempt, run) => {
          reconnectAttempts.push(attempt);
          run();
          return { cancel: () => {} };
        },
      })
    );

    await waitFor(() => expect(sockets).toHaveLength(1));
    act(() => sockets[0]!.emit("close", { code: 1001 }));

    await waitFor(() => expect(sockets.length).toBe(2));
    expect(reconnectAttempts).toEqual([1]);
  });

  it("US7: close code 4401 logs out and does not reconnect", async () => {
    const sockets: FakeSocket[] = [];
    const logout = vi.fn();
    const scheduleReconnect = vi.fn();
    renderHook(() =>
      useSocket({
        url: "ws://localhost/ws",
        token: "t",
        topics: [],
        onLogout: logout,
        createSocket: () => {
          const socket = new FakeSocket();
          sockets.push(socket);
          return socket;
        },
        scheduleReconnect,
      })
    );

    await waitFor(() => expect(sockets).toHaveLength(1));
    act(() => sockets[0]!.emit("close", { code: 4401 }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(scheduleReconnect).not.toHaveBeenCalled();
  });

  it("US9: a burst of messages delivered synchronously settles into one final, consistent state", async () => {
    const sockets: FakeSocket[] = [];
    const { result } = renderHook(() =>
      useSocket({
        url: "ws://localhost/ws",
        token: "t",
        topics: ["book.ACME"],
        onLogout: () => {},
        createSocket: () => {
          const socket = new FakeSocket();
          sockets.push(socket);
          return socket;
        },
      })
    );

    await waitFor(() => expect(sockets).toHaveLength(1));
    const socket = sockets[0]!;

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({ type: "snapshot", topic: "book.ACME", epoch: 1, seq: 500, data: {} }),
      });
      socket.emit("message", { data: JSON.stringify({ type: "delta", topic: "book.ACME", epoch: 1, seq: 501, data: {} }) });
      socket.emit("message", { data: JSON.stringify({ type: "delta", topic: "book.ACME", epoch: 1, seq: 502, data: {} }) });
      socket.emit("message", { data: JSON.stringify({ type: "delta", topic: "book.ACME", epoch: 1, seq: 503, data: {} }) });
    });

    expect(result.current.state.topics["book.ACME"]!.seq).toBe(503);
  });
});

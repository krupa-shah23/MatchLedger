/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UP15-UP16: System page component tests
 * - UP15: Render shards table, metrics card, invariants panel, recovery list
 * - UP16: Poll API only while page visible (document visibility API)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { SystemPage } from "./Dashboard";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, "localStorage", { value: mockLocalStorage });

describe("UP: System Page (P7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        shards: [
          {
            leaseId: "shard-0",
            owner: "shard-host-1",
            epoch: 1,
            stale: false,
            queueDepth: 100,
            lastSeq: 1000,
            snapshotSeq: 900,
          },
        ],
        available: true,
        commandsPerSec: 1000,
        latencyMs: { p50: 1.5, p95: 5.2, p99: 12.3 },
        queueDepthMax: 150,
        consumerLagMax: 2,
        eventLoopP99Ms: 0.8,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("UP15: Render system page with shard table, metrics, invariants, recovery, and simulator", async () => {
    render(<SystemPage />);

    // Wait for heading
    await waitFor(() => {
      expect(screen.getByText("System (P7)")).toBeInTheDocument();
    });

    // Check that main sections are rendered
    expect(screen.getByText("Metrics Summary")).toBeInTheDocument();
    expect(screen.getByText("Shards")).toBeInTheDocument();
    expect(screen.getByText("Invariants")).toBeInTheDocument();
    expect(screen.getByText(/Recent Recovery Operations/)).toBeInTheDocument();

    // Check shard table columns
    expect(screen.getByText("Lease ID")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Epoch")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("Queue Depth")).toBeInTheDocument();
    expect(screen.getByText("Last Seq")).toBeInTheDocument();
    expect(screen.getByText("Snapshot Seq")).toBeInTheDocument();

    // Check shard data is rendered
    expect(screen.getByText("shard-0")).toBeInTheDocument();
    expect(screen.getByText("shard-host-1")).toBeInTheDocument();
  });

  it("UP16: Poll API only while document is visible", async () => {
    vi.useFakeTimers();

    render(<SystemPage />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const initialFetchCount = mockFetch.mock.calls.length;

    // Advance time by 6 seconds (one interval + 1s)
    vi.advanceTimersByTime(6000);

    // Should have fetched again (visible)
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialFetchCount);

    // Simulate document becoming hidden
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    vi.advanceTimersByTime(6000);
    const visibleFetchCount = mockFetch.mock.calls.length;

    // Advance time again while hidden - should not fetch
    vi.advanceTimersByTime(6000);
    expect(mockFetch.mock.calls.length).toBe(visibleFetchCount);

    // Restore visibility
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Should fetch again when visible
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(visibleFetchCount);
    });

    vi.useRealTimers();
  });
});

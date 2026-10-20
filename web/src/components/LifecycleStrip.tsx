/**
 * Visual lifecycle indicator for an order.
 * Shows status progression: received → accepted → resting → filled/rejected
 * Tests: UL2-UL5
 */

import React, { useState, useEffect } from "react";
import { deriveLifecycle, type Order, type LifecycleState } from "../lib/lifecycle.js";

interface LifecycleStripProps {
  order: Order;
  nowMs?: number;
}

export function LifecycleStrip({ order, nowMs }: LifecycleStripProps) {
  const [state, setState] = useState<LifecycleState>();

  useEffect(() => {
    const now = nowMs || Date.now();
    setState(deriveLifecycle(order, now));

    // Update hint display if ACCEPTED and under PENDING_HINT_MS
    if (order.status === "ACCEPTED") {
      const timeout = setInterval(() => {
        setState(deriveLifecycle(order, Date.now()));
      }, 100);
      return () => clearInterval(timeout);
    }
  }, [order, nowMs]);

  if (!state) return null;

  const isSpinning = state.spinner;
  const textColor =
    state.stage === "rejected" ? "red" : state.stage === "cancelled" ? "orange" : "inherit";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        fontSize: "14px",
      }}
    >
      {isSpinning && (
        <span
          style={{
            display: "inline-block",
            animation: "spin 1s linear infinite",
            width: "16px",
            height: "16px",
          }}
        >
          ↻
        </span>
      )}
      <span style={{ color: textColor }}>
        {state.text}
        {state.stage === "accepted" && state.hint && " (waiting...)"}
      </span>
      {state.stage === "rejected" && (
        <span style={{ fontSize: "12px", opacity: 0.7 }}>— {state.reason}</span>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

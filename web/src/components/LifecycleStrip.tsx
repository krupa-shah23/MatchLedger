/**
 * Visual lifecycle indicator for an order.
 * Shows status progression: received → accepted → resting → filled/rejected
 * Tests: UL2-UL5
 */

import React, { useState, useEffect } from "react";
import { deriveLifecycle, type Order, type LifecycleState } from "../lib/lifecycle.js";
import { webConfig } from "../config.js";

interface LifecycleStripProps {
  order: Order;
  nowMs?: number;
}

export function LifecycleStrip({ order, nowMs }: LifecycleStripProps) {
  const [state, setState] = useState<LifecycleState>();

  useEffect(() => {
    const now = nowMs ?? Date.now();
    setState(deriveLifecycle(order, now, webConfig.pendingHintMs));

    // Update hint display if ACCEPTED and under PENDING_HINT_MS
    if (order.status === "ACCEPTED") {
      const timeout = setInterval(() => {
        setState(deriveLifecycle(order, Date.now(), webConfig.pendingHintMs));
      }, 100);
      return () => clearInterval(timeout);
    }
  }, [order, nowMs]);

  if (!state) return null;

  return (
    <div className={`lifecycle lifecycle-${state.stage}`}>
      {state.spinner && <span className="spinner" aria-label="Pending" />}
      <span>{state.text}{state.stage === "accepted" && state.hint && " (waiting...)"}</span>
      {state.stage === "rejected" && <small>— {state.reason}</small>}
    </div>
  );
}

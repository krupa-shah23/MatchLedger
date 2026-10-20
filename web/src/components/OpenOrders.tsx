/**
 * Open orders table with cancel button and lifecycle strip.
 * Test: UP4
 */

import React from "react";
import { LifecycleStrip } from "./LifecycleStrip.js";
import { ApiClient, ApiError } from "../api/client.js";
import type { Order } from "../lib/lifecycle.js";

interface OpenOrdersProps {
  orders: Order[];
  apiBaseUrl: string;
  onCancelRequested?: (orderId: string) => void;
}

export function OpenOrders({ orders, apiBaseUrl, onCancelRequested }: OpenOrdersProps) {
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getToken: () => sessionStorage.getItem("authToken"),
  });

  const openOrders = orders.filter((o) => !["FILLED", "CANCELLED", "REJECTED"].includes(o.status));

  async function handleCancel(orderId: string) {
    try {
      setCancellingId(orderId);
      setCancelError(null);
      await apiClient.delete(`/orders/${orderId}`);
      onCancelRequested?.(orderId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCancelError("Order already finished");
      } else {
        setCancelError(err instanceof Error ? err.message : "Cancel failed");
      }
    } finally {
      setCancellingId(null);
    }
  }

  if (openOrders.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", color: "#999" }}>No open orders</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>Open Orders</h3>
      {cancelError && <div style={{ color: "red", marginBottom: 10 }}>{cancelError}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd" }}>
            <th style={{ textAlign: "left", padding: 8 }}>Order ID</th>
            <th style={{ textAlign: "left", padding: 8 }}>Symbol</th>
            <th style={{ textAlign: "left", padding: 8 }}>Side</th>
            <th style={{ textAlign: "left", padding: 8 }}>Qty</th>
            <th style={{ textAlign: "left", padding: 8 }}>Filled</th>
            <th style={{ textAlign: "left", padding: 8 }}>Price</th>
            <th style={{ textAlign: "left", padding: 8 }}>Status</th>
            <th style={{ textAlign: "left", padding: 8 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {openOrders.map((order) => (
            <React.Fragment key={order.orderId}>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{order.orderId.substring(0, 8)}...</td>
                <td style={{ padding: 8 }}>{order.symbol}</td>
                <td style={{ padding: 8 }}>
                  <strong>{order.side}</strong>
                </td>
                <td style={{ padding: 8 }}>{order.quantity}</td>
                <td style={{ padding: 8 }}>{order.filledQty}</td>
                <td style={{ padding: 8 }}>{order.price || "—"}</td>
                <td style={{ padding: 8, fontSize: 12 }}>
                  <code>{order.status}</code>
                </td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => handleCancel(order.orderId)}
                    disabled={
                      order.status === "CANCEL_REQUESTED" || cancellingId === order.orderId
                    }
                    style={{
                      padding: "4px 8px",
                      fontSize: 12,
                      cursor:
                        order.status === "CANCEL_REQUESTED" || cancellingId === order.orderId
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {cancellingId === order.orderId ? "Cancelling..." : "Cancel"}
                  </button>
                </td>
              </tr>
              <tr>
                <td colSpan={8} style={{ padding: 8, backgroundColor: "#f9f9f9" }}>
                  <LifecycleStrip order={order} />
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

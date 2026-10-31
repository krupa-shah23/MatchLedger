/**
 * Open orders table with cancel button and lifecycle strip.
 * Test: UP4
 */

import React from "react";
import { LifecycleStrip } from "./LifecycleStrip.js";
import { ApiClient, ApiError } from "../api/client.js";
import type { Order } from "../lib/lifecycle.js";
import { useToast } from "./Toast.js";

interface OpenOrdersProps {
  orders: Order[];
  apiBaseUrl: string;
  onCancelRequested?: (orderId: string) => void;
}

export function OpenOrders({ orders, apiBaseUrl, onCancelRequested }: OpenOrdersProps) {
  const { showToast } = useToast();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getToken: () => sessionStorage.getItem("authToken"),
  });

  const openOrders = orders.filter((o) => !["FILLED", "CANCELLED", "REJECTED"].includes(o.status));

  async function handleCancel(id: string) {
    try {
      setCancellingId(id);
      setCancelError(null);
      await apiClient.delete(`/orders/${id}`);
      onCancelRequested?.(id);
    } catch (err) {
      const message = err instanceof ApiError
        ? `Cancel failed (HTTP ${err.status}): ${err.message}`
        : err instanceof Error ? err.message : "Cancel failed";
      setCancelError(message);
      showToast(message, "error");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading"><h3>Open Orders</h3><span className="badge badge-neutral">{openOrders.length} open</span></div>
      {cancelError && <div className="notice notice-error" role="alert">{cancelError}</div>}
      {openOrders.length === 0 ? <p className="empty-state">No open orders</p> : <div className="table-scroll bounded-table"><table>
        <thead><tr><th>Order ID</th><th>Symbol</th><th>Side</th><th className="numeric">Qty</th><th className="numeric">Filled</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{openOrders.map(order => <tr key={order.id}><td><a href={`/orders/${encodeURIComponent(order.id)}`}>{order.id.substring(0, 8)}...</a></td><td><strong>{order.symbol}</strong></td><td><span className={`badge ${order.side === "BUY" ? "badge-good" : "badge-bad"}`}>{order.side}</span></td><td className="numeric">{order.quantity}</td><td className="numeric">{order.filledQty}</td><td><LifecycleStrip order={order} /></td><td><button onClick={() => handleCancel(order.id)} disabled={order.status === "CANCEL_REQUESTED" || cancellingId === order.id}>{cancellingId === order.id ? "Cancelling..." : "Cancel"}</button></td></tr>)}</tbody>
      </table></div>}
    </section>
  );
}

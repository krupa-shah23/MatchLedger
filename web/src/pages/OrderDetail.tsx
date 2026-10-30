/**
 * P4 Order detail: timeline from GET /orders/{id}/events, with the account
 * snapshot and plain-English sentence for a rejection. Tests: UP9, UP10.
 */
import React from "react";
import { useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider.js";
import { ApiError } from "../api/client.js";
import { LifecycleStrip } from "../components/LifecycleStrip.js";
import { formatMoney } from "../utils/money.js";
import type { Order, OrderStatus } from "../lib/lifecycle.js";

interface OrderDetailData extends Order {
  type: "LIMIT" | "MARKET";
  price: string | null;
}

interface OrderEvent {
  seq: number;
  ts: string;
  type: string;
  payload: Record<string, unknown>;
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { client } = useAuth();
  const [order, setOrder] = React.useState<OrderDetailData | null>(null);
  const [events, setEvents] = React.useState<OrderEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const [orderData, eventData] = await Promise.all([
          client.get<OrderDetailData>(`/orders/${orderId}`),
          client.get<OrderEvent[]>(`/orders/${orderId}/events`),
        ]);
        if (cancelled) return;
        setOrder(orderData);
        setEvents(eventData);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load order");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, client]);

  if (!orderId) {
    return <div style={{ padding: 20 }}>No order specified.</div>;
  }

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading order...</div>;
  }

  if (notFound) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Order Not Found</h1>
        <p>Order {orderId} does not exist or you do not have access to it.</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "red" }}>{error ?? "Failed to load order"}</p>
      </div>
    );
  }

  const rejectionEvent = events.find((e) => e.type === "OrderRejected");
  const rejectionPayload = rejectionEvent?.payload as { needed?: string; available?: string } | undefined;
  const isRejected: boolean = order.status === ("REJECTED" as OrderStatus);

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h1>Order {orderId.substring(0, 8)}...</h1>

      <div style={{ marginBottom: 20 }}>
        <LifecycleStrip order={order} />
      </div>

      {isRejected && rejectionPayload && (
        <div style={{ backgroundColor: "#ffcccc", padding: 15, borderRadius: 4, marginBottom: 20 }}>
          Rejected: needed {formatMoney(rejectionPayload.needed ?? "0")}, available {formatMoney(rejectionPayload.available ?? "0")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 15, marginBottom: 20 }}>
        <div>
          <label>Symbol:</label>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>{order.symbol}</div>
        </div>
        <div>
          <label>Side:</label>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>{order.side}</div>
        </div>
        <div>
          <label>Type:</label>
          <div>{order.type}</div>
        </div>
        <div>
          <label>Quantity:</label>
          <div>{order.quantity}</div>
        </div>
        <div>
          <label>Price:</label>
          <div>{order.price ? formatMoney(order.price) : "—"}</div>
        </div>
        <div>
          <label>Filled:</label>
          <div>{order.filledQty}</div>
        </div>
      </div>

      <div>
        <h3>Timeline</h3>
        <div style={{ border: "1px solid #ddd", borderRadius: 4 }}>
          {events.length === 0 ? (
            <p style={{ padding: 15 }}>No events</p>
          ) : (
            events.map((event, i) => (
              <div key={i} style={{ borderBottom: i < events.length - 1 ? "1px solid #eee" : "none", padding: 15 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <strong>#{event.seq}</strong> {event.type}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>{new Date(event.ts).toLocaleTimeString()}</div>
                </div>
                <div style={{ fontSize: 12, backgroundColor: "#f9f9f9", padding: 10, borderRadius: 3 }}>
                  <code>{JSON.stringify(event.payload, null, 2)}</code>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

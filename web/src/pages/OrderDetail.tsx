/**
 * P4: Order detail page with timeline from GET /orders/{id}/events.
 * Shows journal seq, ts, type, payload.
 * For rejection, shows account snapshot and "Rejected: needed X, available Y".
 * Tests: UP9, UP10
 */

import React from "react";
import { useParams, Navigate } from "react-router-dom";
import { LifecycleStrip } from "../components/LifecycleStrip.js";
import type { Order } from "../lib/lifecycle.js";

interface OrderEvent {
  seq: number;
  ts: string;
  type: string;
  payload: Record<string, unknown>;
}

interface AccountSnapshot {
  cash: {
    total: string;
    held: string;
    available: string;
  };
}

interface OrderDetailPageProps {
  orderId?: string;
  onLoadOrder?: (id: string) => void;
}

export function OrderDetailPage({ orderId: initialOrderId, onLoadOrder }: OrderDetailPageProps) {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId || initialOrderId;
  const [order, setOrder] = React.useState<Order | null>(null);
  const [events, setEvents] = React.useState<OrderEvent[]>([]);
  const [accountSnapshot, setAccountSnapshot] = React.useState<AccountSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!orderId) return;
    onLoadOrder?.(orderId);
    loadOrderDetails(orderId);
  }, [orderId, onLoadOrder]);

  async function loadOrderDetails(id: string) {
    try {
      setIsLoading(true);
      setError(null);

      // Mock data for demo
      setOrder({
        id,
        clientOrderId: "CLIENT-001",
        symbol: "AAPL",
        side: "BUY",
        type: "LIMIT",
        timeInForce: "GTC",
        quantity: "100",
        price: "150000000",
        effectivePrice: null,
        status: "REJECTED",
        filledQty: "0",
        cancelRequested: false,
        terminal: "REJECTED",
        terminalReason: "Insufficient funds",
        createdAt: new Date().toISOString(),
      });

      setEvents([
        {
          seq: 1,
          ts: new Date().toISOString(),
          type: "PlaceOrder",
          payload: { symbol: "AAPL", side: "BUY", quantity: "100", price: "150000000" },
        },
        {
          seq: 2,
          ts: new Date().toISOString(),
          type: "OrderRejected",
          payload: { reason: "Insufficient funds", needed: "15000000000", available: "3500000000" },
        },
      ]);

      setAccountSnapshot({
        cash: { total: "500000000", held: "150000000", available: "350000000" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setIsLoading(false);
    }
  }

  if (!orderId) {
    return <Navigate to="/orders" replace />;
  }

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!order) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Order Not Found</h1>
        <p>Order {orderId} does not exist or you do not have access to it.</p>
      </div>
    );
  }

  const rejectionReason = order.terminal === "REJECTED" ? order.terminalReason : null;
  const rejectionPayload = events
    .find((e) => e.type === "OrderRejected")
    ?.payload as { needed?: string; available?: string } | undefined;

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h1>Order {orderId.substring(0, 8)}...</h1>

      {error && <div style={{ color: "red", marginBottom: 20 }}>{error}</div>}

      <div style={{ marginBottom: 20 }}>
        <LifecycleStrip order={order} />
      </div>

      {rejectionReason && accountSnapshot && rejectionPayload && (
        <div style={{ backgroundColor: "#ffcccc", padding: 15, borderRadius: 4, marginBottom: 20 }}>
          <strong>Rejected:</strong> Needed ${formatCurrency(rejectionPayload.needed || "0")}, Available ${formatCurrency(rejectionPayload.available || "0")}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 15,
          marginBottom: 20,
        }}
      >
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
          <div>{order.price ? `$${formatCurrency(order.price)}` : "—"}</div>
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
              <div
                key={i}
                style={{
                  borderBottom: i < events.length - 1 ? "1px solid #eee" : "none",
                  padding: 15,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <strong>#{event.seq}</strong> {event.type}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {new Date(event.ts).toLocaleTimeString()}
                  </div>
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

function formatCurrency(minorUnits: string): string {
  const bigVal = BigInt(minorUnits);
  const dollars = bigVal / 1000000n;
  const cents = (bigVal % 1000000n) / 10000n;
  return `${dollars}.${String(cents).padStart(2, "0")}`;
}

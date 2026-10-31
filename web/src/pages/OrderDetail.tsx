/**
 * P4 Order detail: timeline from GET /orders/{id}/events, with the account
 * snapshot and plain-English sentence for a rejection. Tests: UP9, UP10.
 */
import React from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import { ApiError } from "../api/client.js";
import { PageHeading } from "../components/Ui.js";
import { LifecycleStrip } from "../components/LifecycleStrip.js";
import { displayMoney as formatMoney } from "../utils/display-money.js";
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
    return <div className="page"><div className="empty-state">No order specified.</div></div>;
  }

  if (isLoading) {
    return <div className="loading-state" role="status"><span className="spinner" />Loading order...</div>;
  }

  if (notFound) {
    return (
      <div className="page">
        <PageHeading eyebrow="ORDER DETAILS" title="Order Not Found" description="This order could not be loaded." />
        <p>Order {orderId} does not exist or you do not have access to it.</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page">
        <p role="alert" className="notice notice-error">{error ?? "Failed to load order"}</p>
      </div>
    );
  }

  const rejectionEvent = events.find((e) => e.type === "OrderRejected");
  const rejectionPayload = rejectionEvent?.payload as { needed?: string; available?: string } | undefined;
  const isRejected: boolean = order.status === ("REJECTED" as OrderStatus);

  return (
    <div className="page">
      <PageHeading eyebrow="ORDER DETAILS" title={`Order ${orderId.substring(0, 8)}...`} description="Follow this order from submission to its final outcome." actions={<LifecycleStrip order={order} />} />
      <p className="account-reference mono">{orderId}</p>
      {isRejected && rejectionPayload && (
        <div className="notice notice-error">
          Rejected: needed {formatMoney(rejectionPayload.needed ?? "0")}, available {formatMoney(rejectionPayload.available ?? "0")}
        </div>
      )}
      <section className="panel">
        <h2>Order overview</h2>
        <div className="detail-grid">
          <div><label>Symbol</label><div><strong>{order.symbol}</strong></div></div>
          <div><label>Side</label><div><span className={`badge ${order.side === "BUY" ? "badge-good" : "badge-bad"}`}>{order.side}</span></div></div>
          <div><label>Type</label><div>{order.type}</div></div>
          <div><label>Quantity</label><div>{order.quantity}</div></div>
          <div><label>Price</label><div>{order.price ? formatMoney(order.price) : "—"}</div></div>
          <div><label>Filled</label><div>{order.filledQty}</div></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Timeline</h2><span className="panel-note">Recorded order events</span></div>
        {events.length === 0 ? <div className="empty-state">No events</div> : (
          <div className="timeline">{events.map((event, i) => (
            <div key={i} className="timeline-event">
              <div className="timeline-event-heading">
                <div><strong className="badge badge-neutral">#{event.seq}</strong> <span>{event.type}</span></div>
                <time dateTime={event.ts}>{new Date(event.ts).toLocaleString()}</time>
              </div>
              <pre className="event-payload">{JSON.stringify(event.payload, null, 2)}</pre>
            </div>
          ))}</div>
        )}
      </section>
    </div>
  );
}

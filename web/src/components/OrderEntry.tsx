/**
 * Order entry form with inline validation mirroring server rules.
 * Tests: UF1-UF5
 */

import React, { useState } from "react";
import { ApiClient, ApiError } from "../api/client.js";

interface OrderEntryProps {
  symbol: string;
  apiBaseUrl: string;
  onOrderSubmitted?: (orderId: string) => void;
}

export function OrderEntry({ symbol, apiBaseUrl, onOrderSubmitted }: OrderEntryProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [clientOrderId, setClientOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<string | null>(null);

  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getToken: () => sessionStorage.getItem("authToken"),
  });

  // Validation
  const qtyNum = parseInt(quantity) || 0;
  const priceStr = price.trim();
  const qtyError = qtyNum <= 0 ? "Quantity must be positive" : null;
  const priceError =
    orderType === "LIMIT" && !priceStr ? "Price required for LIMIT orders" : null;
  const marketPriceError =
    orderType === "MARKET" && price ? "MARKET orders must not have price" : null;
  const clientIdError = !clientOrderId ? "Client order ID required" : null;

  const canSubmit = !qtyError && !priceError && !marketPriceError && !clientIdError;

  // Update estimate
  React.useEffect(() => {
    if (orderType === "LIMIT" && qtyNum > 0 && priceNum > 0) {
      const est = BigInt(qtyNum) * BigInt(Math.floor(priceNum * 1000000));
      setEstimate(est.toString());
    } else if (orderType === "MARKET") {
      setEstimate(null);
    }
  }, [quantity, price, orderType, qtyNum, priceNum]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // Generate clientOrderId with retry suffix on 409
    let submissionId = clientOrderId;
    let retryCount = 0;

    try {
      setIsSubmitting(true);
      setError(null);

      // Retry on 409 (conflict - already submitted)
      while (retryCount < 3) {
        try {
          const response = await apiClient.post<any>("/orders", {
            clientOrderId: submissionId,
            symbol,
            side,
            type: orderType,
            timeInForce: orderType === "MARKET" ? "IOC" : "GTC",
            quantity: qtyNum.toString(),
            price: orderType === "LIMIT" ? price : undefined,
          });

          onOrderSubmitted?.(response.orderId);
          setQuantity("");
          setPrice("");
          setClientOrderId("");
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            // Already submitted - likely a retry. Use same clientOrderId again
            // Server will de-duplicate and return the original orderId
            retryCount++;
            submissionId = `${clientOrderId}-retry${retryCount}`;
          } else if (err instanceof ApiError && err.status === 429) {
            setError(`Rate limited. Retry after ${err.retryAfterMs?.toLocaleString()}ms`);
            return;
          } else if (err instanceof ApiError && err.status === 503) {
            setError(`Service unavailable. Retry after ${err.retryAfterMs?.toLocaleString()}ms`);
            return;
          } else {
            throw err;
          }
        }
      }

      setError("Order already submitted (conflict after retries)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3>Order Entry</h3>

      <div>
        <label>Side:</label>
        <select value={side} onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      <div>
        <label>Type:</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as "LIMIT" | "MARKET")}
        >
          <option value="LIMIT">LIMIT</option>
          <option value="MARKET">MARKET</option>
        </select>
      </div>

      <div>
        <label>Quantity:</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={isSubmitting}
        />
        {qtyError && <span style={{ color: "red", fontSize: 12 }}>{qtyError}</span>}
      </div>

      {orderType === "LIMIT" && (
        <div>
          <label>Price:</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isSubmitting}
          />
          {priceError && <span style={{ color: "red", fontSize: 12 }}>{priceError}</span>}
        </div>
      )}

      {estimate && (
        <div style={{ backgroundColor: "#f5f5f5", padding: 8, borderRadius: 4, fontSize: 12 }}>
          <strong>Estimate:</strong> ${(() => { const bigVal = BigInt(estimate); const dollars = bigVal / 1000000n; const cents = (bigVal % 1000000n) / 10000n; return `${dollars}.${String(cents).padStart(2, "0")}`; })()}
        </div>
      )}

      <div>
        <label>Client Order ID:</label>
        <input
          type="text"
          value={clientOrderId}
          onChange={(e) => setClientOrderId(e.target.value)}
          disabled={isSubmitting}
        />
        {clientIdError && <span style={{ color: "red", fontSize: 12 }}>{clientIdError}</span>}
      </div>

      {error && <div style={{ color: "red", fontSize: 12 }}>{error}</div>}

      <button type="submit" disabled={!canSubmit || isSubmitting}>
        {isSubmitting ? "Submitting..." : `Submit ${side}`}
      </button>
    </form>
  );
}

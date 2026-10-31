/**
 * Order entry form with inline validation mirroring server rules.
 * Tests: UF1-UF5
 */

import React, { useRef, useState } from "react";
import { ApiClient, ApiError } from "../api/client.js";
import { parseDecimalToMinor } from "@matchledger/common";
import { estimateReservation, formatMoney } from "../utils/money.js";
import { useToast } from "./Toast.js";

function createClientOrderId(): string {
  return `web-${globalThis.crypto.randomUUID()}`;
}

interface RetryIdentity {
  fingerprint: string;
  clientOrderId: string;
  retryable: boolean;
}

interface OrderEntryProps {
  symbol: string;
  apiBaseUrl: string;
  marketHalted?: boolean;
  onOrderSubmitted?: (orderId: string) => void;
}

export function OrderEntry({ symbol, apiBaseUrl, marketHalted = false, onOrderSubmitted }: OrderEntryProps) {
  const { showToast } = useToast();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const retryIdentity = useRef<RetryIdentity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<string | null>(null);

  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getToken: () => sessionStorage.getItem("authToken"),
  });

  // Validation
  const quantityValue = quantity.trim();
  const priceStr = price.trim();
  const qtyError = /^[1-9][0-9]*$/.test(quantityValue) ? null : quantityValue ? "Enter a positive whole-number quantity" : "Quantity is required";
  let priceError: string | null = null;
  if (orderType === "LIMIT") {
    if (!priceStr) priceError = "Limit price is required";
    else {
      try {
        if (parseDecimalToMinor(priceStr, 2) <= 0n) priceError = "Limit price must be greater than zero";
      }
      catch { priceError = "Enter a valid price with up to 2 decimal places"; }
    }
  }
  const marketPriceError =
    orderType === "MARKET" && price ? "MARKET orders must not have price" : null;
  const canSubmit = !qtyError && !priceError && !marketPriceError && !marketHalted;

  // Estimate = price x quantity as bigint, never floating point. No estimate for MARKET.
  React.useEffect(() => {
    if (orderType === "LIMIT" && !qtyError && !priceError && priceStr) {
      try {
        const priceMinor = parseDecimalToMinor(priceStr, 2);
        setEstimate(estimateReservation(quantityValue, priceMinor.toString()).toString());
      } catch {
        setEstimate(null);
      }
    } else {
      setEstimate(null);
    }
  }, [quantity, price, orderType, quantityValue, qtyError, priceError, priceStr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const order = {
        symbol,
        side,
        type: orderType,
        timeInForce: orderType === "MARKET" ? "IOC" : "GTC",
        quantity: quantityValue,
        ...(orderType === "LIMIT" ? { price: priceStr } : {}),
      };
      const fingerprint = JSON.stringify(order);
      const previousAttempt = retryIdentity.current;
      const clientOrderId = previousAttempt?.retryable && previousAttempt.fingerprint === fingerprint
        ? previousAttempt.clientOrderId
        : createClientOrderId();
      retryIdentity.current = { fingerprint, clientOrderId, retryable: false };
      const response = await apiClient.post<{ orderId?: string }>("/orders", { ...order, clientOrderId });

      if (response.orderId) onOrderSubmitted?.(response.orderId);
      retryIdentity.current = null;
      setQuantity("");
      setPrice("");
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        retryIdentity.current = null;
        setError("This order conflicted with an earlier request. Review Open Orders; submit again to use a fresh internal reference.");
        showToast("The order reference conflicted. Review Open Orders, then submit again to retry with a fresh reference.", "error");
      } else if (err instanceof ApiError && err.status === 429) {
        if (retryIdentity.current) retryIdentity.current.retryable = true;
        setError(`Rate limited. Retry after ${err.retryAfterMs?.toLocaleString()}ms`);
        showToast("You're sending orders too quickly. Please wait a moment and try again.", "error");
      } else if (err instanceof ApiError && err.status === 503) {
        if (retryIdentity.current) retryIdentity.current.retryable = true;
        setError(`Service unavailable. Retry after ${err.retryAfterMs?.toLocaleString()}ms`);
        showToast("Trading is temporarily busy. Nothing was submitted - please try again shortly.", "error");
      } else {
        if (retryIdentity.current) retryIdentity.current.retryable = true;
        setError(err instanceof Error ? err.message : "Order submission failed");
        showToast("Your order couldn't be submitted. Please try again.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel order-entry">
      <div className="panel-heading"><h3>Order Entry</h3><span className="badge badge-neutral">{symbol}</span></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="order-side">Side</label><select id="order-side" aria-label="Order side" value={side} onChange={e => setSide(e.target.value as "BUY" | "SELL")} disabled={isSubmitting}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></div>
        <div className="field"><label htmlFor="order-type">Type</label><select id="order-type" aria-label="Order type" value={orderType} onChange={e => setOrderType(e.target.value as "LIMIT" | "MARKET")} disabled={isSubmitting}><option value="LIMIT">LIMIT</option><option value="MARKET">MARKET</option></select></div>
      </div>
      <div className="field"><label htmlFor="order-quantity">Quantity <span className="required-mark">Required</span></label><input id="order-quantity" aria-label="Order quantity" type="text" inputMode="numeric" placeholder="Enter quantity" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={isSubmitting} aria-invalid={Boolean(quantity && qtyError)} />{quantity && qtyError && <span className="field-error">{qtyError}</span>}</div>
      {orderType === "LIMIT" && <div className="field"><label htmlFor="order-price">Limit price <span className="required-mark">Required</span></label><input id="order-price" aria-label="Order price" type="text" inputMode="decimal" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} disabled={isSubmitting} aria-invalid={Boolean(price && priceError)} />{price && priceError && <span className="field-error">{priceError}</span>}</div>}
      {orderType === "LIMIT" && estimate && <div className="estimate-box"><strong>Estimate:</strong><span className="mono">{formatMoney(BigInt(estimate))}</span></div>}
      {orderType === "MARKET" && <p className="panel-note">No estimate for MARKET orders; the cap appears after acceptance.</p>}
      <p className="panel-note">A unique order reference is generated automatically when you submit.</p>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <button type="submit" className="full-width" disabled={!canSubmit || isSubmitting}>{isSubmitting && <span className="spinner" aria-hidden="true" />}{isSubmitting ? "Submitting..." : `Submit ${side}`}</button>
      {marketHalted ? <p className="notice notice-warning order-submit-guidance">Orders are paused for {symbol} while its breaker is OPEN. Ask a Risk Officer to resume the market.</p> : !canSubmit && <p className="order-submit-guidance" role="status">Complete the required fields above with valid values to submit.</p>}
      <p className="order-entry-note">Submission stays pending until the order's outcome arrives. Follow its progress below.</p>
    </form>
  );
}

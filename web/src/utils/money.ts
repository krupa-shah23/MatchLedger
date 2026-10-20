/**
 * Money formatting utilities for UI display.
 * Re-exports core codec; adds currency formatting.
 * Tests: UZ1-UZ4
 */

export { decodeMoney, encodeMoney, MAX_MONEY, MIN_MONEY } from "@matchledger/common";

/**
 * Format bigint (in minor units) as USD currency string.
 * Example: 1500000n (15.00 as bigint) -> "$15.00"
 */
export function formatMoney(minorUnits: bigint | string | number | null): string {
  if (!minorUnits) return "$0.00";

  let value: bigint;
  if (typeof minorUnits === "bigint") {
    value = minorUnits;
  } else if (typeof minorUnits === "string") {
    try {
      value = BigInt(minorUnits);
    } catch {
      return "Invalid";
    }
  } else {
    value = BigInt(Math.floor(minorUnits));
  }

  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const absDollars = absValue / 100n;
  const absCents = absValue % 100n;

  return `${isNegative ? "-" : ""}$${absDollars}.${String(absCents).padStart(2, "0")}`;
}

/**
 * Format quantity string for display.
 */
export function formatQuantity(qty: string | number | null): string {
  if (!qty) return "0";
  if (typeof qty === "number") return qty.toString();
  return qty;
}

/**
 * Format timestamp for display (relative or absolute).
 */
export function formatTime(isoString: string, relative = false): string {
  try {
    const date = new Date(isoString);
    if (relative) {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 60000) return "just now";
      if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
      if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
      return `${Math.floor(diffMs / 86400000)}d ago`;
    }
    return date.toLocaleString();
  } catch {
    return "Invalid date";
  }
}

/**
 * Calculate reservation estimate (bigint) for a given quantity and price cap.
 * Returns 0 for MARKET orders (no price cap).
 */
export function estimateReservation(quantity: string | number, priceCap: string | null): bigint {
  if (!priceCap || priceCap === "null") {
    // MARKET order - no estimate
    return 0n;
  }

  try {
    const qty = BigInt(typeof quantity === "number" ? Math.floor(quantity) : quantity);
    const price = BigInt(priceCap);
    return qty * price;
  } catch {
    return 0n;
  }
}

/**
 * Calculate cumulative depth at a given price level.
 */
export function cumulativeDepth(bids: Array<[string, string]>, asksPrice: string): bigint {
  try {
    const targetPrice = BigInt(asksPrice);
    let cumulative = 0n;

    for (const [price, qty] of bids) {
      const p = BigInt(price);
      if (p >= targetPrice) {
        cumulative += BigInt(qty);
      }
    }

    return cumulative;
  } catch {
    return 0n;
  }
}

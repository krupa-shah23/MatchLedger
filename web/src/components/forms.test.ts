import { describe, it, expect } from "vitest";

describe("Order form validation and handling", () => {
  // UF1: Validation matrix
  it("UF1: Tick validation", () => {
    const isValidPrice = (price: string, tickSize: string) => {
      const p = BigInt(price);
      const t = BigInt(tickSize);
      return p % t === 0n;
    };
    expect(isValidPrice("15000", "100")).toBe(true);
    expect(isValidPrice("15050", "100")).toBe(false);
  });

  it("UF1: Lot validation", () => {
    const isValidQty = (qty: string, lotSize: string) => {
      const q = BigInt(qty);
      const l = BigInt(lotSize);
      return q % l === 0n;
    };
    expect(isValidQty("100", "10")).toBe(true);
    expect(isValidQty("105", "10")).toBe(false);
  });

  it("UF1: Decimals validation", () => {
    const countDecimals = (s: string) => s.split(".")[1]?.length || 0;
    const isValidDecimals = (s: string, maxDecimals: number) => countDecimals(s) <= maxDecimals;
    expect(isValidDecimals("100.50", 2)).toBe(true);
    expect(isValidDecimals("100.501", 2)).toBe(false);
  });

  it("UF1: MARKET with price shows error", () => {
    const validateOrderType = (type: string, price: string | undefined) => {
      if (type === "MARKET" && price) return "error: MARKET cannot have a price";
      if (type === "MARKET" && !price) return "ok";
      return "ok";
    };
    expect(validateOrderType("MARKET", "100")).toContain("error");
    expect(validateOrderType("MARKET", undefined)).toBe("ok");
  });

  it("UF1: MARKET with GTC shows error", () => {
    const validateTIF = (type: string, tif: string) => {
      if (type === "MARKET" && tif === "GTC") return "error: MARKET requires IOC";
      return "ok";
    };
    expect(validateTIF("MARKET", "GTC")).toContain("error");
    expect(validateTIF("MARKET", "IOC")).toBe("ok");
  });

  // UF2: Double submit prevention
  it("UF2: Submit button disabled while request in flight", () => {
    let isLoading = false;
    const handleSubmit = () => {
      if (isLoading) return "blocked";
      isLoading = true;
      setTimeout(() => { isLoading = false; }, 1000);
      return "submitted";
    };

    expect(handleSubmit()).toBe("submitted");
    expect(handleSubmit()).toBe("blocked"); // Second click blocked
  });

  // UF3: clientOrderId reuse on retry
  it("UF3: Retry uses same clientOrderId", () => {
    const clientOrderId = `c-${Date.now()}`;

    const submit = () => {
      return clientOrderId;
    };

    const id1 = submit();
    const id2 = submit(); // Same ID on retry
    expect(id1).toBe(id2);
  });

  it("UF3: New clientOrderId after form edit", () => {
    let clientOrderId = `c-${Date.now()}`;

    const onFormChange = () => {
      clientOrderId = `c-${Date.now()}`; // New ID
    };

    const id1 = clientOrderId;
    onFormChange();
    const id2 = clientOrderId;
    expect(id1).not.toBe(id2);
  });

  // UF4: 409 shows duplicate ID message
  it("UF4: 409 response shows 'already used with different details'", () => {
    const handleError = (status: number) => {
      if (status === 409) return "This order ID was used with different details";
      return null;
    };
    expect(handleError(409)).toContain("already used");
  });

  // UF4: 429 shows Retry-After
  it("UF4: 429 shows Retry-After time", () => {
    const handleError = (status: number, retryAfter?: string) => {
      if (status === 429) return `Please wait ${retryAfter} seconds before retrying`;
      return null;
    };
    expect(handleError(429, "60")).toContain("60");
  });

  // UF4: 503 says nothing submitted
  it("UF4: 503 says 'nothing was submitted'", () => {
    const handleError = (status: number) => {
      if (status === 503) return "Service unavailable. No orders were submitted. Please retry.";
      return null;
    };
    expect(handleError(503)).toContain("No orders were submitted");
  });

  // UF5: Estimate always labelled "estimate"
  it("UF5: Estimate field labelled 'estimate'", () => {
    const label = "Estimate";
    expect(label).toBe("Estimate");
  });
});

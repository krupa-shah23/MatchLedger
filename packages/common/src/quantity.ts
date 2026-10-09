export type QuantityError = "INVALID_QUANTITY" | "UNSAFE_INTEGER" | "ABOVE_MAXIMUM";

export type ParsedQuantity =
  | { readonly ok: true; readonly value: bigint }
  | { readonly ok: false; readonly error: QuantityError };

export function parseQuantity(input: unknown, max: bigint): ParsedQuantity {
  let value: bigint;

  // Check number shape, then safe-integer status, then convert and apply quantity bounds.
  if (typeof input === "number") {
    if (!Number.isInteger(input)) {
      return { ok: false, error: "INVALID_QUANTITY" };
    }
    if (!Number.isSafeInteger(input)) {
      return { ok: false, error: "UNSAFE_INTEGER" };
    }
    value = BigInt(input);
  } else if (typeof input === "string") {
    if (!/^(0|[1-9][0-9]*)$/.test(input)) {
      return { ok: false, error: "INVALID_QUANTITY" };
    }
    value = BigInt(input);
  } else {
    return { ok: false, error: "INVALID_QUANTITY" };
  }

  if (value <= 0n) {
    return { ok: false, error: "INVALID_QUANTITY" };
  }
  if (value > max) {
    return { ok: false, error: "ABOVE_MAXIMUM" };
  }
  return { ok: true, value };
}

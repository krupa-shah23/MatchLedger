export const MAX_AMOUNT = 2n ** 63n - 1n;

export function notional(price: bigint, quantity: bigint): bigint {
  if (price <= 0n || quantity <= 0n) {
    throw new RangeError("price and quantity must be positive bigint values");
  }
  const value = price * quantity;
  if (value > MAX_AMOUNT) {
    throw new RangeError("notional exceeds MAX_AMOUNT");
  }
  return value;
}

export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) {
    throw new RangeError("divisor must be positive");
  }
  const quotient = a / b;
  const remainder = a % b;
  return remainder === 0n ? quotient : quotient + 1n;
}

export function floorDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) {
    throw new RangeError("divisor must be positive");
  }
  return a / b;
}

export function ceilToTick(value: bigint, tick: bigint): bigint {
  if (tick <= 0n) {
    throw new RangeError("tick must be positive");
  }
  const quotient = value / tick;
  const remainder = value % tick;
  if (remainder === 0n) return value;
  return (quotient + 1n) * tick;
}

export function floorToTick(value: bigint, tick: bigint): bigint {
  if (tick <= 0n) {
    throw new RangeError("tick must be positive");
  }
  return (value / tick) * tick;
}

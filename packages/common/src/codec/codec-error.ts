export class CodecError extends Error {
  public constructor(public readonly field: string, message: string) {
    super(`CodecError[${field}]: ${message}`);
    this.name = "CodecError";
  }
}

export function requireString(obj: Record<string, unknown>, field: string): string {
  const v = obj[field];
  if (typeof v !== "string") throw new CodecError(field, `expected string, got ${typeof v}`);
  return v;
}

export function requireOptionalString(obj: Record<string, unknown>, field: string): string | undefined {
  const v = obj[field];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new CodecError(field, `expected string or absent, got ${typeof v}`);
  return v;
}

export function requireNumber(obj: Record<string, unknown>, field: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new CodecError(field, `expected finite number, got ${typeof v}`);
  return v;
}

export function requireOptionalNumber(obj: Record<string, unknown>, field: string): number | undefined {
  const v = obj[field];
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new CodecError(field, `expected finite number or absent, got ${typeof v}`);
  return v;
}

const DECIMAL_RE = /^-?\d+$/;

export function requireBigint(obj: Record<string, unknown>, field: string): bigint {
  const v = obj[field];
  if (typeof v !== "string" || !DECIMAL_RE.test(v)) throw new CodecError(field, `expected canonical decimal string, got ${JSON.stringify(v)}`);
  return BigInt(v);
}

export function requireOptionalBigint(obj: Record<string, unknown>, field: string): bigint | undefined {
  const v = obj[field];
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !DECIMAL_RE.test(v)) throw new CodecError(field, `expected canonical decimal string or absent, got ${JSON.stringify(v)}`);
  return BigInt(v);
}

export function requireEnum<T extends string>(obj: Record<string, unknown>, field: string, allowed: readonly T[]): T {
  const v = obj[field];
  if (typeof v !== "string" || !allowed.includes(v as T)) throw new CodecError(field, `expected one of ${allowed.join("|")}, got ${JSON.stringify(v)}`);
  return v as T;
}

export function requireOptionalEnum<T extends string>(obj: Record<string, unknown>, field: string, allowed: readonly T[]): T | undefined {
  const v = obj[field];
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !allowed.includes(v as T)) throw new CodecError(field, `expected one of ${allowed.join("|")} or absent, got ${JSON.stringify(v)}`);
  return v as T;
}

/** Deterministic key order serialization: callers build a plain object with keys
 * already in the desired canonical order, so JSON.stringify preserves that order. */
export function canonicalStringify(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

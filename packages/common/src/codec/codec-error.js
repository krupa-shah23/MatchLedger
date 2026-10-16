export class CodecError extends Error {
    field;
    constructor(field, message) {
        super(`CodecError[${field}]: ${message}`);
        this.field = field;
        this.name = "CodecError";
    }
}
export function requireString(obj, field) {
    const v = obj[field];
    if (typeof v !== "string")
        throw new CodecError(field, `expected string, got ${typeof v}`);
    return v;
}
export function requireOptionalString(obj, field) {
    const v = obj[field];
    if (v === undefined)
        return undefined;
    if (typeof v !== "string")
        throw new CodecError(field, `expected string or absent, got ${typeof v}`);
    return v;
}
export function requireNumber(obj, field) {
    const v = obj[field];
    if (typeof v !== "number" || !Number.isFinite(v))
        throw new CodecError(field, `expected finite number, got ${typeof v}`);
    return v;
}
export function requireOptionalNumber(obj, field) {
    const v = obj[field];
    if (v === undefined)
        return undefined;
    if (typeof v !== "number" || !Number.isFinite(v))
        throw new CodecError(field, `expected finite number or absent, got ${typeof v}`);
    return v;
}
const DECIMAL_RE = /^-?\d+$/;
export function requireBigint(obj, field) {
    const v = obj[field];
    if (typeof v !== "string" || !DECIMAL_RE.test(v))
        throw new CodecError(field, `expected canonical decimal string, got ${JSON.stringify(v)}`);
    return BigInt(v);
}
export function requireOptionalBigint(obj, field) {
    const v = obj[field];
    if (v === undefined)
        return undefined;
    if (typeof v !== "string" || !DECIMAL_RE.test(v))
        throw new CodecError(field, `expected canonical decimal string or absent, got ${JSON.stringify(v)}`);
    return BigInt(v);
}
export function requireEnum(obj, field, allowed) {
    const v = obj[field];
    if (typeof v !== "string" || !allowed.includes(v))
        throw new CodecError(field, `expected one of ${allowed.join("|")}, got ${JSON.stringify(v)}`);
    return v;
}
export function requireOptionalEnum(obj, field, allowed) {
    const v = obj[field];
    if (v === undefined)
        return undefined;
    if (typeof v !== "string" || !allowed.includes(v))
        throw new CodecError(field, `expected one of ${allowed.join("|")} or absent, got ${JSON.stringify(v)}`);
    return v;
}
/** Deterministic key order serialization: callers build a plain object with keys
 * already in the desired canonical order, so JSON.stringify preserves that order. */
export function canonicalStringify(payload) {
    return JSON.stringify(payload);
}

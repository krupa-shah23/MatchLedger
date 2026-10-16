export declare class CodecError extends Error {
    readonly field: string;
    constructor(field: string, message: string);
}
export declare function requireString(obj: Record<string, unknown>, field: string): string;
export declare function requireOptionalString(obj: Record<string, unknown>, field: string): string | undefined;
export declare function requireNumber(obj: Record<string, unknown>, field: string): number;
export declare function requireOptionalNumber(obj: Record<string, unknown>, field: string): number | undefined;
export declare function requireBigint(obj: Record<string, unknown>, field: string): bigint;
export declare function requireOptionalBigint(obj: Record<string, unknown>, field: string): bigint | undefined;
export declare function requireEnum<T extends string>(obj: Record<string, unknown>, field: string, allowed: readonly T[]): T;
export declare function requireOptionalEnum<T extends string>(obj: Record<string, unknown>, field: string, allowed: readonly T[]): T | undefined;
/** Deterministic key order serialization: callers build a plain object with keys
 * already in the desired canonical order, so JSON.stringify preserves that order. */
export declare function canonicalStringify(payload: Record<string, unknown>): string;

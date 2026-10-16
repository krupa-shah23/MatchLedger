export type QuantityError = "INVALID_QUANTITY" | "UNSAFE_INTEGER" | "ABOVE_MAXIMUM";
export type ParsedQuantity = {
    readonly ok: true;
    readonly value: bigint;
} | {
    readonly ok: false;
    readonly error: QuantityError;
};
export declare function parseQuantity(input: unknown, max: bigint): ParsedQuantity;

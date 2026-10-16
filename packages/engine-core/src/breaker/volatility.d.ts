export declare const ceilDiv: (value: bigint, divisor: bigint) => bigint;
export declare const floorDiv: (value: bigint, divisor: bigint) => bigint;
export declare const volatilityBps: (window: readonly bigint[]) => bigint;
export declare const bandBounds: (anchor: bigint, bps: bigint) => {
    readonly lower: bigint;
    readonly upper: bigint;
};

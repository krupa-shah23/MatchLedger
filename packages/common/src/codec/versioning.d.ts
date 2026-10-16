export declare const CURRENT_VERSION = 2;
export declare class UnknownSchemaVersionError extends Error {
    readonly version: unknown;
    constructor(version: unknown);
}
export type Upcaster<T = unknown> = (v0: unknown) => T;
export declare function registerUpcaster(version: number, fn: Upcaster): void;
export declare function getUpcaster(version: number): Upcaster | undefined;

export const CURRENT_VERSION = 2;

export class UnknownSchemaVersionError extends Error {
  public constructor(public readonly version: unknown) {
    super(`Unknown schema version: ${String(version)}`);
    this.name = "UnknownSchemaVersionError";
  }
}

export type Upcaster<T = unknown> = (v0: unknown) => T;

const upcasters = new Map<number, Upcaster>();

export function registerUpcaster(version: number, fn: Upcaster): void {
  upcasters.set(version, fn);
}

export function getUpcaster(version: number): Upcaster | undefined {
  return upcasters.get(version);
}

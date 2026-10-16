export const CURRENT_VERSION = 2;
export class UnknownSchemaVersionError extends Error {
    version;
    constructor(version) {
        super(`Unknown schema version: ${String(version)}`);
        this.version = version;
        this.name = "UnknownSchemaVersionError";
    }
}
const upcasters = new Map();
export function registerUpcaster(version, fn) {
    upcasters.set(version, fn);
}
export function getUpcaster(version) {
    return upcasters.get(version);
}

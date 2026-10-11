export function fnv1a32(value: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    hash ^= codeUnit;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function partitionOf(accountId: string, partitions: number): number {
  if (!Number.isSafeInteger(partitions) || partitions <= 0) {
    throw new RangeError("partitions must be a positive safe integer");
  }
  return fnv1a32(accountId) % partitions;
}

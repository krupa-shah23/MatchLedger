import { decodeMoney, encodeMoney } from "@matchledger/common";

export interface Envelope {
  schemaVersion: number;
  msgId: string;
  type: string;
  payload: unknown;
}

/**
 * Versioned envelope codec: converts JS values to JSON, replacing bigints with decimal strings.
 * Uses the shared money codec (decodeMoney/encodeMoney) for round-trip safety.
 */
export function encodeEnvelope(envelope: Envelope): string {
  const replacer = (_key: string, value: unknown) => {
    if (typeof value === "bigint") {
      return encodeMoney(value);
    }
    return value;
  };
  return JSON.stringify(envelope, replacer);
}

export function decodeEnvelope(json: string): Envelope {
  const reviver = (_key: string, value: unknown) => {
    if (typeof value === "string" && /^-?(0|[1-9][0-9]*)$/.test(value)) {
      try {
        return decodeMoney(value);
      } catch {
        return value;
      }
    }
    return value;
  };
  return JSON.parse(json, reviver);
}

/**
 * Dead-letter publisher: sends undecodable or invalid messages to dlq.<topic>
 * with metadata about the error and original coordinates.
 */
export interface DeadLetterEntry {
  topic: string;
  partition: number;
  offset: bigint;
  error: string;
  rawBytes: Buffer;
  timestamp: number;
}

export function createDeadLetterMessage(entry: DeadLetterEntry): string {
  return JSON.stringify({
    schemaVersion: 1,
    msgId: `dlq-${entry.topic}-${entry.partition}-${entry.offset}`,
    type: "dead-letter",
    payload: {
      source: { topic: entry.topic, partition: entry.partition, offset: entry.offset.toString() },
      error: entry.error,
      rawBytes: entry.rawBytes.toString("base64"),
      timestamp: entry.timestamp,
    },
  });
}

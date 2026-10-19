/**
 * Password hashing with scrypt
 * Format: scrypt$N$r$p$saltB64$hashB64
 */

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384; // 2^14 (balance between security and memory)
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const DUMMY_HASH = "scrypt$16384$8$1$dGVzdHNhbHQ=$invalid$"; // For timing-safe unknown user rejection

/**
 * Hash a password using scrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(SALT_BYTES);
    scrypt(password, salt, HASH_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, hash) => {
      if (err) reject(err);
      else {
        const saltB64 = salt.toString("base64");
        const hashB64 = hash.toString("base64");
        resolve(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${saltB64}$${hashB64}`);
      }
    });
  });
}

/**
 * Verify a password against a hash
 * Returns false for invalid hash format
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const nStr = parts[1];
  const rStr = parts[2];
  const pStr = parts[3];
  const saltB64 = parts[4];
  const hashB64 = parts[5];

  if (!nStr || !rStr || !pStr || !saltB64 || !hashB64) {
    return false;
  }

  const n = parseInt(nStr);
  const r = parseInt(rStr);
  const p = parseInt(pStr);

  if (isNaN(n) || isNaN(r) || isNaN(p)) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const salt = Buffer.from(saltB64, "base64");
      const expectedHash = Buffer.from(hashB64, "base64");

      scrypt(password, salt, expectedHash.length, { N: n, r, p }, (err, computedHash) => {
        if (err) {
          resolve(false);
          return;
        }

        // Compare hashes using timing-safe equal if lengths match
        if (computedHash.length !== expectedHash.length) {
          resolve(false);
          return;
        }

        try {
          const isMatch = timingSafeEqual(computedHash, expectedHash);
          resolve(isMatch);
        } catch {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Get a dummy hash for timing-safe unknown user rejection
 * This hash will always fail verification
 */
export function getDummyHash(): string {
  return DUMMY_HASH;
}

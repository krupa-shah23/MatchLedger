/**
 * Password hashing with scrypt.
 * Format: scryptNrpsaltB64$hashB64
 */

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const N = 16384;
const r = 8;
const p = 1;
const keyLen = 64;

/**
 * Hash a password with random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, keyLen)) as Buffer;

  const saltB64 = salt.toString("base64");
  const hashB64 = hash.toString("base64");

  return `scrypt${N}r${r}p${p}salt${saltB64}$${hashB64}`;
}

/**
 * Verify password against hash.
 * Timing-safe comparison.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const match = /^scrypt(\d+)r(\d+)p(\d+)salt(.+)\$(.+)$/.exec(hash);
  if (!match || match.length < 6) return false;

  const nStr = match[1];
  const rStr = match[2];
  const pStr = match[3];
  const saltB64 = match[4];
  const hashB64 = match[5];

  if (!nStr || !rStr || !pStr || !saltB64 || !hashB64) return false;

  const n = parseInt(nStr, 10);
  const r_ = parseInt(rStr, 10);
  const p_ = parseInt(pStr, 10);

  if (n !== N || r_ !== r || p_ !== p) {
    // Hash parameters mismatch: compute dummy hash for timing
    await scryptAsync(password, randomBytes(16), keyLen);
    return false;
  }

  const salt = Buffer.from(saltB64, "base64");
  const expectedHash = Buffer.from(hashB64, "base64");
  const computed = (await scryptAsync(password, salt, keyLen)) as Buffer;

  try {
    timingSafeEqual(computed, expectedHash);
    return true;
  } catch {
    return false;
  }
}

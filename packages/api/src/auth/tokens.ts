/**
 * JWT token handling with jose
 */

import { jwtVerify, SignJWT } from "jose";
import type { ApiRole } from "@matchledger/common";

export interface JWTClaims {
  sub: string; // user_id
  role: ApiRole;
  iat: number; // issued at
  exp: number; // expiration
  jti: string; // JWT ID (unique per token)
  auth_time: number; // original login time
}

export interface TokenConfig {
  secret: Uint8Array;
  ttlSeconds: number;
}

/**
 * Create a new JWT token
 */
export async function signToken(
  config: TokenConfig,
  userId: string,
  role: ApiRole,
  authTime: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const jti = Math.random().toString(36).substring(2, 15);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: userId,
    role,
    auth_time: authTime,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + config.ttlSeconds)
    .setJti(jti)
    .sign(config.secret);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(config: TokenConfig, token: string): Promise<JWTClaims> {
  try {
    const { payload } = await jwtVerify(token, config.secret, {
      algorithms: ["HS256"],
    });

    return payload as unknown as JWTClaims;
  } catch (error) {
    throw new Error(`Invalid token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

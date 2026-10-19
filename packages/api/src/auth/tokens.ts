/**
 * JWT token handling with jose (HS256).
 */

import * as jose from "jose";

export interface JwtClaims {
  sub: string; // user_id
  role: "TRADER" | "RISK" | "OPS" | "ADMIN";
  iat: number; // issued at
  exp: number; // expiration
  jti: string; // token id
  auth_time: number; // original login time
}

/**
 * Sign a JWT token.
 */
export async function signToken(
  claims: Omit<JwtClaims, "iat" | "exp" | "jti">,
  secret: Uint8Array,
  ttlSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);

  const payload = {
    sub: claims.sub,
    role: claims.role,
    auth_time: claims.auth_time,
    iat: now,
    exp: now + ttlSeconds,
    jti,
  };

  const jwt = new jose.SignJWT(payload).setProtectedHeader({ alg: "HS256" });
  return jwt.sign(secret);
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyToken(
  token: string,
  secret: Uint8Array
): Promise<JwtClaims | null> {
  try {
    const verified = await jose.jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return {
      sub: String(verified.payload.sub),
      role: verified.payload.role as JwtClaims["role"],
      iat: Number(verified.payload.iat),
      exp: Number(verified.payload.exp),
      jti: String(verified.payload.jti),
      auth_time: Number(verified.payload.auth_time),
    };
  } catch {
    return null;
  }
}

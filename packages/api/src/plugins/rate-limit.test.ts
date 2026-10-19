/**
 * RLM: Rate Limiting tests
 */

import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate-limit.js";

describe("RLM: Rate Limiting", () => {
  it("RLM1: Token bucket allows burst and refills", () => {
    let now = 1000;
    const limiter = new RateLimiter({
      tokensPerSecond: 10,
      burstSize: 20,
      now: () => now,
    });

    // User1: Burst: consume 20 tokens
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume("user1")).toBe(0);
    }

    // 21st request fails (no tokens left)
    expect(limiter.tryConsume("user1")).toBeGreaterThan(0);

    // After 1 second, user1 gets 10 more tokens (refill rate)
    now += 1000;
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume("user1")).toBe(0);
    }
    // 11th request on user1 should fail (only 10 tokens from refill)
    expect(limiter.tryConsume("user1")).toBeGreaterThan(0);

    // User2 has fresh burst at time 2000
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume("user2")).toBe(0);
    }
    expect(limiter.tryConsume("user2")).toBeGreaterThan(0);
  });

  it("RLM1: Retry-After is rounded up", () => {
    const now = 1000;
    const limiter = new RateLimiter({
      tokensPerSecond: 2,
      burstSize: 2,
      now: () => now,
    });

    // Consume burst
    expect(limiter.tryConsume("user1")).toBe(0);
    expect(limiter.tryConsume("user1")).toBe(0);

    // Next request needs to wait 0.5 seconds
    const waitMs = limiter.tryConsume("user1");
    expect(waitMs).toBeGreaterThanOrEqual(500);
  });

  it("RLM2: POST /orders per account rate limiting", () => {
    const now = 1000;
    const limiter = new RateLimiter({
      tokensPerSecond: 10,
      burstSize: 20,
      now: () => now,
    });

    // User1 burns through quota
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume("user1")).toBe(0);
    }

    // User1 is rate limited
    expect(limiter.tryConsume("user1")).toBeGreaterThan(0);

    // User2 has fresh quota
    expect(limiter.tryConsume("user2")).toBe(0);
    expect(limiter.tryConsume("user2")).toBe(0);

    // User1 still limited
    expect(limiter.tryConsume("user1")).toBeGreaterThan(0);
  });

  it("RLM3: Login limiter per IP and per username", () => {
    const now = 1000;
    const ipLimiter = new RateLimiter({
      tokensPerSecond: 5,
      burstSize: 5,
      now: () => now,
    });
    const usernameLimiter = new RateLimiter({
      tokensPerSecond: 5,
      burstSize: 5,
      now: () => now,
    });

    // IP 192.168.1.1 burns through quota
    for (let i = 0; i < 5; i++) {
      expect(ipLimiter.tryConsume("192.168.1.1")).toBe(0);
    }
    expect(ipLimiter.tryConsume("192.168.1.1")).toBeGreaterThan(0);

    // Username alice burns through quota
    for (let i = 0; i < 5; i++) {
      expect(usernameLimiter.tryConsume("alice")).toBe(0);
    }
    expect(usernameLimiter.tryConsume("alice")).toBeGreaterThan(0);

    // Different IP and username succeed
    expect(ipLimiter.tryConsume("192.168.1.2")).toBe(0);
    expect(usernameLimiter.tryConsume("bob")).toBe(0);
  });
});

/**
 * In-memory token bucket rate limiter
 * Time is injected for testability
 */

export interface RateLimiterOptions {
  tokensPerSecond: number;
  burstSize: number;
  now?: () => number; // Injected time for testing
}

export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private tokensPerSecond: number;
  private burstSize: number;
  private now: () => number;

  constructor(opts: RateLimiterOptions) {
    this.tokensPerSecond = opts.tokensPerSecond;
    this.burstSize = opts.burstSize;
    this.now = opts.now ?? (() => Date.now());
  }

  /**
   * Check if a request is allowed and consume a token.
   * Returns milliseconds until next token is available, or 0 if allowed.
   */
  tryConsume(key: string, tokens: number = 1): number {
    const now = this.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.burstSize, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.burstSize,
      bucket.tokens + elapsedSeconds * this.tokensPerSecond
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return 0; // Request allowed
    }

    // Not enough tokens: calculate wait time
    const tokensNeeded = tokens - bucket.tokens;
    const waitSeconds = tokensNeeded / this.tokensPerSecond;
    return Math.ceil(waitSeconds * 1000);
  }
}

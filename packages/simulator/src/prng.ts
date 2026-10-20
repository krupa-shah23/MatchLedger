/**
 * Mulberry32: A simple, fast, deterministic PRNG.
 * Same seed always produces the same sequence.
 * No side effects; creates a new state object per instance.
 */

export interface PRNGState {
  a: number;
}

export function mulberry32(seed: number): () => number {
  const state: PRNGState = { a: seed >>> 0 };

  return () => {
    let t = (state.a += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random integer in [min, max] inclusive.
 */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Random choice from array.
 */
export function randomChoice<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * Geometric distribution: probability of success p.
 * Returns the number of trials until the first success.
 */
export function randomGeometric(rng: () => number, p: number): number {
  return Math.floor(Math.log(1 - rng()) / Math.log(1 - p));
}

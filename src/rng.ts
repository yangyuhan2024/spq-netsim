/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Every simulation run takes a seed so that results are reproducible:
 * the same config + seed always produces exactly the same numbers.
 */
export class Rng {
  #state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) {
      throw new Error(`seed must be an integer, got ${seed}`);
    }
    // Avoid an all-zero state.
    this.#state = seed >>> 0 || 0x9e3779b9;
  }

  /** Uniform sample in [0, 1). */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Exponential sample with the given mean (inverse-transform method). */
  exponential(mean: number): number {
    if (!(mean > 0)) {
      throw new Error(`exponential mean must be > 0, got ${mean}`);
    }
    // 1 - next() is in (0, 1], so the log is always finite.
    return -mean * Math.log(1 - this.next());
  }
}

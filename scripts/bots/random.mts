/** Seeded PRNG (mulberry32) so a failing run's choices and timings can be replayed with the same seed. */
export class Rng {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error("pick from an empty list");
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** A child generator: each bot gets its own stream so adding a bot does not shift the others' choices. */
  public fork(label: string): Rng {
    let hash = this.state ^ 0x9e3779b9;
    for (const char of label) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    return new Rng(hash);
  }
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

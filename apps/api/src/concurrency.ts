import { HttpError } from "./http";

/** Bound CPU/vendor work and queued promises instead of admitting an unbounded burst. */
export class BoundedExecutor {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  public constructor(private readonly concurrency: number, private readonly maxQueued: number) {}

  public async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      if (this.waiting.length >= this.maxQueued) throw new HttpError(503, "The service is busy. Please try again shortly.");
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active++;
    }
    try { return await work(); }
    finally {
      const next = this.waiting.shift();
      if (next) next(); else this.active--;
    }
  }
}

export async function mapConcurrent<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

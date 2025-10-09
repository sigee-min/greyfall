export class SlidingWindowLimiter {
  private buckets = new Map<string, number[]>();
  constructor(private maxEvents: number, private windowMs: number) {}

  allow(key: string, now = Date.now()): boolean {
    const arr = this.buckets.get(key) ?? [];
    // prune old
    const cutoff = now - this.windowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();
    if (arr.length >= this.maxEvents) {
      this.buckets.set(key, arr);
      return false;
    }
    arr.push(now);
    this.buckets.set(key, arr);
    return true;
  }
}


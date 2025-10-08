export class SlidingWindowLimiter {
    constructor(maxEvents, windowMs) {
        this.maxEvents = maxEvents;
        this.windowMs = windowMs;
        this.buckets = new Map();
    }
    allow(key, now = Date.now()) {
        const arr = this.buckets.get(key) ?? [];
        // prune old
        const cutoff = now - this.windowMs;
        while (arr.length && arr[0] < cutoff)
            arr.shift();
        if (arr.length >= this.maxEvents) {
            this.buckets.set(key, arr);
            return false;
        }
        arr.push(now);
        this.buckets.set(key, arr);
        return true;
    }
}

import { SlidingWindowLimiter } from './rate-limit.js';

export type LimiterPolicy = { limit: number; windowMs: number };

const DEFAULT_POLICY: LimiterPolicy = { limit: 10, windowMs: 10_000 };

const POLICIES: Record<string, LimiterPolicy> = {
  'ready': { limit: 5, windowMs: 10_000 },
  'chat': { limit: 5, windowMs: 10_000 },
  'move': { limit: 10, windowMs: 10_000 },
  'travel:propose': { limit: 4, windowMs: 10_000 },
  'travel:vote': { limit: 16, windowMs: 10_000 },
  'object:request': { limit: 5, windowMs: 10_000 }
};

const cache = new Map<string, SlidingWindowLimiter>();

export function getLimiter(name: string): SlidingWindowLimiter {
  const existing = cache.get(name);
  if (existing) return existing;
  const p = POLICIES[name] ?? DEFAULT_POLICY;
  const limiter = new SlidingWindowLimiter(p.limit, p.windowMs);
  cache.set(name, limiter);
  return limiter;
}

export function setLimiterPolicy(name: string, policy: LimiterPolicy) {
  cache.delete(name);
  (POLICIES as Record<string, LimiterPolicy>)[name] = policy;
}

// Ack scheduling (resend/backoff) policy
export type AckSchedulePolicy = {
  maxAttempts: number; // how many times to retry scheduling before giving up
  baseDelayMs: number; // base delay per attempt (linear backoff)
  maxDelayMs: number; // cap per-attempt delay
};

let ACK_SCHEDULE: AckSchedulePolicy = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 5000 };

export function getAckSchedulePolicy(): AckSchedulePolicy {
  return ACK_SCHEDULE;
}

export function setAckSchedulePolicy(policy: AckSchedulePolicy) {
  ACK_SCHEDULE = policy;
}

// DataChannel queue/backpressure policy
export type QueuePolicy = {
  baseThreshold: number; // default bufferedAmountLowThreshold fallback
  highWaterFactor: number; // when to enqueue (buffered > threshold * factor)
  flushFactor: number; // when to stop flushing (buffered > threshold * factor)
  maxQueue: number; // max pending messages per peer
};

let QUEUE_POLICY: QueuePolicy = { baseThreshold: 64 * 1024, highWaterFactor: 4, flushFactor: 2, maxQueue: 256 };

export function getQueuePolicy(): QueuePolicy {
  return QUEUE_POLICY;
}

export function setQueuePolicy(policy: QueuePolicy) {
  QUEUE_POLICY = policy;
}

// Patch queue (client) policy — when queued patches stall too long, request snapshot
export type PatchQueuePolicy = {
  timeoutMs: number; // how long to wait before requesting snapshot for stalled queue
  maxQueuedRevs: number; // per-object max queued patch revisions before forcing snapshot
  debounceMs: number; // future use: debounced consolidate of multiple stalls
};

let PATCH_QUEUE_POLICY: PatchQueuePolicy = { timeoutMs: 2500, maxQueuedRevs: 32, debounceMs: 250 };

export function getPatchQueuePolicy(): PatchQueuePolicy {
  return PATCH_QUEUE_POLICY;
}

export function setPatchQueuePolicy(policy: PatchQueuePolicy) {
  PATCH_QUEUE_POLICY = policy;
}

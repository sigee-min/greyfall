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

// Snapshot compression policy — compress oversized replace payloads
export type SnapshotPolicy = {
  compressOverBytes: number; // if JSON.stringify(value).length exceeds this, compress
};

let SNAPSHOT_POLICY: SnapshotPolicy = { compressOverBytes: 256 * 1024 };

export function getSnapshotPolicy(): SnapshotPolicy {
  return SNAPSHOT_POLICY;
}

export function setSnapshotPolicy(policy: SnapshotPolicy) {
  SNAPSHOT_POLICY = policy;
}

// Environment-driven overrides (Vite import.meta.env)
function readEnvNumber(key: string): number | undefined {
  try {
    const v = (import.meta as any)?.env?.[key];
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function applyLimiterEnv(name: string) {
  const lim = readEnvNumber(`VITE_NET_LIMIT_${name.toUpperCase()}_LIMIT`);
  const win = readEnvNumber(`VITE_NET_LIMIT_${name.toUpperCase()}_WINDOW_MS`);
  if (lim != null || win != null) {
    const prev = POLICIES[name] ?? { limit: 10, windowMs: 10_000 };
    POLICIES[name] = { limit: lim ?? prev.limit, windowMs: win ?? prev.windowMs };
    cache.delete(name);
  }
}

// Load policies from env at module init
(function loadPoliciesFromEnv() {
  // Ack schedule
  const ackMax = readEnvNumber('VITE_NET_ACK_MAX_ATTEMPTS');
  const ackBase = readEnvNumber('VITE_NET_ACK_BASE_DELAY_MS');
  const ackMaxDelay = readEnvNumber('VITE_NET_ACK_MAX_DELAY_MS');
  if (ackMax != null || ackBase != null || ackMaxDelay != null) {
    ACK_SCHEDULE = {
      maxAttempts: ackMax ?? ACK_SCHEDULE.maxAttempts,
      baseDelayMs: ackBase ?? ACK_SCHEDULE.baseDelayMs,
      maxDelayMs: ackMaxDelay ?? ACK_SCHEDULE.maxDelayMs
    };
  }

  // Queue policy
  const qBase = readEnvNumber('VITE_NET_QUEUE_BASE_THRESHOLD');
  const qHigh = readEnvNumber('VITE_NET_QUEUE_HIGH_FACTOR');
  const qFlush = readEnvNumber('VITE_NET_QUEUE_FLUSH_FACTOR');
  const qMax = readEnvNumber('VITE_NET_QUEUE_MAX');
  if (qBase != null || qHigh != null || qFlush != null || qMax != null) {
    QUEUE_POLICY = {
      baseThreshold: qBase ?? QUEUE_POLICY.baseThreshold,
      highWaterFactor: qHigh ?? QUEUE_POLICY.highWaterFactor,
      flushFactor: qFlush ?? QUEUE_POLICY.flushFactor,
      maxQueue: qMax ?? QUEUE_POLICY.maxQueue
    };
  }

  // Patch queue policy
  const pqTimeout = readEnvNumber('VITE_NET_PATCH_QUEUE_TIMEOUT_MS');
  const pqMax = readEnvNumber('VITE_NET_PATCH_QUEUE_MAX_QUEUED');
  const pqDebounce = readEnvNumber('VITE_NET_PATCH_QUEUE_DEBOUNCE_MS');
  if (pqTimeout != null || pqMax != null || pqDebounce != null) {
    PATCH_QUEUE_POLICY = {
      timeoutMs: pqTimeout ?? PATCH_QUEUE_POLICY.timeoutMs,
      maxQueuedRevs: pqMax ?? PATCH_QUEUE_POLICY.maxQueuedRevs,
      debounceMs: pqDebounce ?? PATCH_QUEUE_POLICY.debounceMs
    };
  }

  // Snapshot policy
  const snapOver = readEnvNumber('VITE_NET_SNAPSHOT_COMPRESS_OVER_BYTES');
  if (snapOver != null) {
    SNAPSHOT_POLICY = { compressOverBytes: snapOver };
  }

  // Limiter policies
  for (const name of Object.keys(POLICIES)) applyLimiterEnv(name);
})();

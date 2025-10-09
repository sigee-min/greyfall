import { SlidingWindowLimiter } from './rate-limit.js';
const DEFAULT_POLICY = { limit: 10, windowMs: 10000 };
const POLICIES = {
    'ready': { limit: 5, windowMs: 10000 },
    'chat': { limit: 5, windowMs: 10000 },
    'move': { limit: 10, windowMs: 10000 },
    'travel:propose': { limit: 4, windowMs: 10000 },
    'travel:vote': { limit: 16, windowMs: 10000 },
    'object:request': { limit: 5, windowMs: 10000 }
};
const cache = new Map();
export function getLimiter(name) {
    const existing = cache.get(name);
    if (existing)
        return existing;
    const p = POLICIES[name] ?? DEFAULT_POLICY;
    const limiter = new SlidingWindowLimiter(p.limit, p.windowMs);
    cache.set(name, limiter);
    return limiter;
}
export function setLimiterPolicy(name, policy) {
    cache.delete(name);
    POLICIES[name] = policy;
}
let ACK_SCHEDULE = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 5000 };
export function getAckSchedulePolicy() {
    return ACK_SCHEDULE;
}
export function setAckSchedulePolicy(policy) {
    ACK_SCHEDULE = policy;
}
let QUEUE_POLICY = { baseThreshold: 64 * 1024, highWaterFactor: 4, flushFactor: 2, maxQueue: 256 };
export function getQueuePolicy() {
    return QUEUE_POLICY;
}
export function setQueuePolicy(policy) {
    QUEUE_POLICY = policy;
}
let PATCH_QUEUE_POLICY = { timeoutMs: 2500, maxQueuedRevs: 32, debounceMs: 250 };
export function getPatchQueuePolicy() {
    return PATCH_QUEUE_POLICY;
}
export function setPatchQueuePolicy(policy) {
    PATCH_QUEUE_POLICY = policy;
}
let SNAPSHOT_POLICY = { compressOverBytes: 256 * 1024 };
export function getSnapshotPolicy() {
    return SNAPSHOT_POLICY;
}
export function setSnapshotPolicy(policy) {
    SNAPSHOT_POLICY = policy;
}
// Environment-driven overrides (Vite import.meta.env)
function readEnvNumber(key) {
    try {
        const v = import.meta?.env?.[key];
        if (v == null)
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    }
    catch {
        return undefined;
    }
}
function applyLimiterEnv(name) {
    const lim = readEnvNumber(`VITE_NET_LIMIT_${name.toUpperCase()}_LIMIT`);
    const win = readEnvNumber(`VITE_NET_LIMIT_${name.toUpperCase()}_WINDOW_MS`);
    if (lim != null || win != null) {
        const prev = POLICIES[name] ?? { limit: 10, windowMs: 10000 };
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
    for (const name of Object.keys(POLICIES))
        applyLimiterEnv(name);
})();

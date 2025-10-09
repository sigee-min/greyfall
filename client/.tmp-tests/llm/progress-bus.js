const listeners = new Set();
let last = null;
export function emitProgress(report) {
    last = report;
    for (const l of Array.from(listeners)) {
        try {
            l(report);
        }
        catch { /* noop */ }
    }
}
export function subscribeProgress(cb) {
    listeners.add(cb);
    if (last) {
        try {
            cb(last);
        }
        catch { /* noop */ }
    }
    return () => listeners.delete(cb);
}
export function getLastProgress() { return last; }
export function clearProgress() {
    last = null;
}

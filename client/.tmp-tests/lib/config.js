// If VITE_SIGNAL_SERVER_URL is provided, use that absolute origin.
// Otherwise, default to same-origin with HTTP under /api and WS under /ws.
const explicitSignalOrigin = import.meta.env.VITE_SIGNAL_SERVER_URL?.replace(/\/$/, '') ?? null;
export const SIGNAL_SERVER_HTTP_URL = explicitSignalOrigin; // may be null when using same-origin proxy
export const SIGNAL_SERVER_ENABLED = true; // same-origin proxy is available by default
export function buildSignalHttpUrl(path) {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    if (explicitSignalOrigin)
        return `${explicitSignalOrigin}${suffix}`;
    return `/api${suffix}`;
}
export function buildSignalWsUrl(sessionId, role) {
    let base;
    if (explicitSignalOrigin) {
        base = new URL(explicitSignalOrigin);
    }
    else {
        // same-origin
        base = new URL(window.location.origin);
    }
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = '/ws';
    base.searchParams.set('session', sessionId);
    base.searchParams.set('role', role);
    return base.toString();
}

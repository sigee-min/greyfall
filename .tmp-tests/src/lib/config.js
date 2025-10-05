const rawSignalUrl = import.meta.env.VITE_SIGNAL_SERVER_URL ?? 'http://localhost:8787';
const normalisedSignalUrl = rawSignalUrl.replace(/\/$/, '');
export const SIGNAL_SERVER_HTTP_URL = normalisedSignalUrl;
export const SIGNAL_SERVER_ENABLED = Boolean(normalisedSignalUrl);
export function buildSignalWsUrl(sessionId, role) {
    if (!SIGNAL_SERVER_HTTP_URL) {
        throw new Error('Signal server URL is not configured');
    }
    const base = new URL(SIGNAL_SERVER_HTTP_URL);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = '/ws';
    base.searchParams.set('session', sessionId);
    base.searchParams.set('role', role);
    return base.toString();
}

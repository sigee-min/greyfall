// Logs API base (same-origin reverse proxy under /api)
const LOGS_API_BASE = '/api';
// Dev-only helper: do NOT bundle secrets in production.
function getAuthHeader() {
    // Gate behind build-time flag so Vite can tree-shake this in production.
    if (!import.meta.env.DEV)
        return null;
    const user = import.meta.env.VITE_LOGS_BASIC_USER;
    const pass = import.meta.env.VITE_LOGS_BASIC_PASS;
    if (!user || !pass)
        return null;
    try {
        const token = btoa(`${user}:${pass}`);
        return `Basic ${token}`;
    }
    catch {
        return null;
    }
}
export async function postLlmLog(payload) {
    const url = `${LOGS_API_BASE}/llm/logs`;
    try {
        const auth = getAuthHeader();
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(auth ? { Authorization: auth } : {})
            },
            body: JSON.stringify({ ...payload, client_at: new Date().toISOString() })
        });
        return res.ok;
    }
    catch {
        return false;
    }
}

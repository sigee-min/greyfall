type LlmLogPayload = {
  request_id: string;
  request_type: string;
  input_text: string;
  output_text: string;
  client_at?: string;
};

// Logs API base (same-origin reverse proxy under /api)
const LOGS_API_BASE = '/api';

// Dev-only helper: do NOT bundle secrets in production.
function getAuthHeader(): string | null {
  // Gate behind build-time flag so Vite can tree-shake this in production.
  if (!import.meta.env.DEV) return null;
  const user = import.meta.env.VITE_LOGS_BASIC_USER as unknown as string | undefined;
  const pass = import.meta.env.VITE_LOGS_BASIC_PASS as unknown as string | undefined;
  if (!user || !pass) return null;
  try {
    const token = btoa(`${user}:${pass}`);
    return `Basic ${token}`;
  } catch {
    return null;
  }
}

export async function postLlmLog(payload: LlmLogPayload): Promise<boolean> {
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
  } catch {
    return false;
  }
}

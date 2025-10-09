type LlmLogPayload = {
  request_id: string;
  request_type: string;
  input_text: string;
  output_text: string;
  client_at?: string;
};

function getBaseUrl(): string {
  const explicit = (import.meta as any)?.env?.VITE_LOGS_SERVER_URL as string | undefined;
  if (explicit && explicit.trim()) return explicit.replace(/\/$/, '') + '/api';
  // default: same-origin reverse proxy under /api
  return '/api';
}

function getAuthHeader(): string | null {
  const user = (import.meta as any)?.env?.VITE_LOGS_BASIC_USER as string | undefined;
  const pass = (import.meta as any)?.env?.VITE_LOGS_BASIC_PASS as string | undefined;
  if (!user || !pass) return null;
  try {
    // Basic auth; encode as base64(user:pass)
    const token = btoa(`${user}:${pass}`);
    return `Basic ${token}`;
  } catch {
    return null;
  }
}

export async function postLlmLog(payload: LlmLogPayload): Promise<boolean> {
  const base = getBaseUrl();
  const url = `${base}/llm/logs`;
  const auth = getAuthHeader();
  try {
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


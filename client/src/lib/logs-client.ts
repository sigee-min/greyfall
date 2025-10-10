type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type LlmLogPayload = {
  request_id: string;
  request_type: string;
  messages: ChatMessage[];
  client_at?: string;
};

// Logs API base (same-origin reverse proxy under /api)
const LOGS_API_BASE = '/api';

export async function postLlmLog(payload: LlmLogPayload): Promise<boolean> {
  const url = `${LOGS_API_BASE}/llm/logs`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...payload, client_at: new Date().toISOString() })
    });
    return res.ok;
  } catch {
    return false;
  }
}

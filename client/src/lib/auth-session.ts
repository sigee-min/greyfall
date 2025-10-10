import type { AuthUser } from './auth';

export async function signinWithGoogle(credential: string): Promise<{ ok: boolean; user?: AuthUser; token?: string }>
{
  const res = await fetch('/api/auth/google/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  if (!res.ok) return { ok: false };
  const json = (await res.json()) as { ok: boolean; user?: AuthUser; token?: string };
  return json.ok ? json : { ok: false };
}

export async function getMe(withToken = false): Promise<{ ok: boolean; user?: AuthUser; token?: string }>
{
  const url = withToken ? '/api/auth/me?with_token=1' : '/api/auth/me';
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!res.ok) return { ok: false };
  const json = (await res.json()) as { ok: boolean; user?: AuthUser; token?: string };
  return json.ok ? json : { ok: false };
}

export async function logout(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}


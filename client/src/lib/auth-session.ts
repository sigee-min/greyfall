import type { AuthUser } from './auth';
import type { AuthNonceResponse } from '@shared/protocol';

export async function signinWithGoogle(credential: string, nonceOrToken?: string, kind: 'nonce' | 'token' = 'token'): Promise<{ ok: boolean; user?: AuthUser; token?: string }>
{
  const res = await fetch('/api/auth/google/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      kind === 'token'
        ? { credential, ...(nonceOrToken ? { nonceToken: nonceOrToken } : {}) }
        : { credential, ...(nonceOrToken ? { nonce: nonceOrToken } : {}) }
    )
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

export async function getAuthNonce(): Promise<{ ok: boolean; nonce?: string; nonceToken?: string }>
{
  try {
    const res = await fetch('/api/auth/nonce', { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as AuthNonceResponse;
    return json.ok ? { ok: true, nonce: json.nonce, nonceToken: json.nonceToken } : { ok: false };
  } catch {
    return { ok: false };
  }
}

// In-flight dedupe helpers (dev StrictMode safe)
let inflightAuthMe: Promise<{ ok: boolean; user?: AuthUser; token?: string } | { ok: false }> | null = null;
export function getMeDedup(withToken = false) {
  if (!inflightAuthMe) {
    inflightAuthMe = getMe(withToken).finally(() => { inflightAuthMe = null; });
  }
  return inflightAuthMe;
}

type UsersMe = { ok: boolean; user?: { id: number; name?: string | null; picture?: string | null; role?: string } };
let inflightUsersMe: Promise<UsersMe> | null = null;
export async function getUsersMeDedup(): Promise<UsersMe> {
  if (inflightUsersMe) return inflightUsersMe;
  inflightUsersMe = (async () => {
    try {
      const res = await fetch('/api/users/me', { headers: { Accept: 'application/json' } });
      if (!res.ok) return { ok: false } as UsersMe;
      const json = (await res.json()) as UsersMe;
      return json;
    } catch {
      return { ok: false } as UsersMe;
    } finally {
      inflightUsersMe = null;
    }
  })();
  return inflightUsersMe;
}

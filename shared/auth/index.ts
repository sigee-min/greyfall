import { createHmac, timingSafeEqual } from 'node:crypto';

export type JwtHeader = { alg: 'HS256'; typ: 'JWT' };
export type JwtPayload = {
  sub: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  email?: string;
  name?: string;
  picture?: string;
  role?: string;
  [k: string]: unknown;
};

export const DEFAULT_SESSION_TTL_SEC = 60 * 60 * 5; // 5 hours

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 2 ? '==' : input.length % 4 === 3 ? '=' : '';
  const str = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(str, 'base64');
}

export function signJwtHS256(payload: JwtPayload, secret: string): string {
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64urlEncode(JSON.stringify(header));
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(data).digest();
  const sigB64 = b64urlEncode(sig);
  return `${data}.${sigB64}`;
}

export function verifyJwtHS256(token: string, secret: string): { ok: true; payload: JwtPayload } | { ok: false; reason: string } {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [h, p, s] = parts;
  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = JSON.parse(b64urlDecode(h).toString('utf8')) as JwtHeader;
    payload = JSON.parse(b64urlDecode(p).toString('utf8')) as JwtPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!header || header.alg !== 'HS256') return { ok: false, reason: 'alg' };
  const data = `${h}.${p}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const given = b64urlDecode(s);
  try {
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'signature' };
  } catch {
    return { ok: false, reason: 'signature' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now >= payload.exp) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}

export function parseBearer(authHeader: string | string[] | undefined): string | null {
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}


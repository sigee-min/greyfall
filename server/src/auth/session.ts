import type { IncomingMessage } from 'node:http';
import { signJwtHS256, verifyJwtHS256, type JwtPayload } from '@shared/auth';
import type { AppConfig } from '../config.js';

export type SessionUser = JwtPayload & { sub: string };

export function createSessionToken(user: SessionUser, cfg: AppConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.max(60, cfg.sessionTtlSec);
  const payload: JwtPayload = { ...user, iat: now, exp };
  return signJwtHS256(payload, cfg.jwtSecret);
}

export function verifySessionToken(token: string, cfg: AppConfig): SessionUser | null {
  const v = verifyJwtHS256(token, cfg.jwtSecret);
  if (!v.ok) return null;
  const payload = v.payload;
  if (!payload?.sub) return null;
  return payload as SessionUser;
}

export function parseCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers['cookie'];
  if (!header) return null;
  const raw = Array.isArray(header) ? header.join(';') : header;
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    if (k !== name) continue;
    try {
      return decodeURIComponent(p.slice(idx + 1));
    } catch {
      return p.slice(idx + 1);
    }
  }
  return null;
}


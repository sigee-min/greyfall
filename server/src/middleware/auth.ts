import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseBearer } from '@shared/auth';
import type { AppConfig } from '../config.js';
import { parseCookie, verifySessionToken, type SessionUser } from '../auth/session.js';
import { sendJson } from '../utils.js';

export type AuthResult = { ok: true; user: SessionUser } | { ok: false };

export function checkAuthUnified(req: IncomingMessage, res: ServerResponse, cfg: AppConfig): AuthResult {
  const bearer = parseBearer(req.headers['authorization']);
  const cookieToken = parseCookie(req, cfg.cookieName);
  const token = bearer || cookieToken;
  if (token) {
    const user = verifySessionToken(token, cfg);
    if (user) return { ok: true, user };
  }
  sendJson(res, 401, { error: 'Unauthorized', code: 'UNAUTHORIZED' });
  return { ok: false };
}

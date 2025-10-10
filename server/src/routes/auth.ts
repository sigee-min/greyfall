import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig, type AppConfig } from '../config.js';
import { parseBody, parseUrl } from '../utils.js';
import { sendOk, sendError } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { authSigninRequestSchema, authSigninResponseSchema, authMeResponseSchema, authNonceResponseSchema } from '@shared/protocol';
import { logger } from '../lib/logger.js';
import { getContext } from '../middleware/ctx.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { createSessionToken, parseCookie, verifySessionToken } from '../auth/session.js';
import { signJwtHS256, verifyJwtHS256 } from '@shared/auth';
import { upsertGoogleUser } from '../users/service.js';

function setSessionCookie(res: ServerResponse, cfg: AppConfig, token: string, maxAgeSec: number) {
  const parts = [
    `${cfg.cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.max(1, maxAgeSec)}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (String(process.env.NODE_ENV).toLowerCase() === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function handleAuthRoutes(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith('/api/auth/')) return false;
  const cfg = await loadConfig();

  // GET /api/auth/nonce → issue short-lived nonce + signed token
  if (pathname === '/api/auth/nonce' && req.method === 'GET') {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    const nonce = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: 'nonce', iat: now, exp: now + 120, nonce };
    const nonceToken = signJwtHS256(payload, cfg.jwtSecret);
    try { validate(authNonceResponseSchema, { ok: true, nonce, nonceToken }); } catch {}
    sendOk(res, { nonce, nonceToken });
    return true;
  }

  // POST /api/auth/google/signin { credential, nonceToken? (preferred), nonce? (legacy) }
  if (pathname === '/api/auth/google/signin' && req.method === 'POST') {
    const body = await parseBody<any>(req);
    try {
      validate(authSigninRequestSchema, body);
    } catch (e: any) {
      sendError(res, { code: 'VALIDATION_ERROR', status: 400, details: e?.details });
      return true;
    }
    const credential: string | undefined = body?.credential;
    const nonceToken: string | undefined = typeof body?.nonceToken === 'string' ? body.nonceToken : undefined;
    let expectedNonce: string | undefined = typeof body?.nonce === 'string' ? body.nonce : undefined;
    if (nonceToken) {
      const vr = verifyJwtHS256(nonceToken, cfg.jwtSecret);
      if (!vr.ok || typeof (vr.payload as any).nonce !== 'string') {
        sendError(res, { code: 'UNAUTHORIZED', status: 401, message: 'Invalid nonce token' });
        return true;
      }
      expectedNonce = (vr.payload as any).nonce as string;
    }
    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    if (!googleClientId) { sendError(res, { code: 'CONFIG', status: 500, message: 'Missing GOOGLE_CLIENT_ID' }); return true; }
    const gp = await verifyGoogleIdToken(credential as string, googleClientId, expectedNonce);
    if (!gp) { logger.warn('signin-failed', { reqId: getContext(req)?.reqId, reason: 'invalid-google-token' }); sendError(res, { code: 'UNAUTHORIZED', status: 401, message: 'Invalid Google token' }); return true; }
    const sub = `google:${gp.sub}`;
    const stored = await upsertGoogleUser(cfg, { sub, email: gp.email, name: gp.name, picture: gp.picture });
    const jwtUser = { sub, iss: 'greyfall', role: stored.role as any };
    const token = createSessionToken(jwtUser as any, cfg);
    setSessionCookie(res, cfg, token, cfg.sessionTtlSec);
    try { validate(authSigninResponseSchema, { ok: true, user: { sub, name: stored.name ?? undefined, picture: stored.picture ?? undefined, role: stored.role as any }, token }); } catch {}
    logger.info('signin-ok', { reqId: getContext(req)?.reqId, sub });
    sendOk(res, { user: { sub, name: stored.name ?? undefined, picture: stored.picture ?? undefined, role: stored.role as any }, token });
    return true;
  }

  // GET /api/auth/me
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const bearer = Array.isArray(req.headers['authorization']) ? req.headers['authorization'][0] : req.headers['authorization'];
    const token = (bearer && /^Bearer\s+(.+)$/i.exec(bearer)?.[1]) || parseCookie(req, (await loadConfig()).cookieName);
    if (!token) { sendError(res, { code: 'UNAUTHORIZED', status: 401, message: 'No session' }); return true; }
    const user = verifySessionToken(token, cfg);
    if (!user) { sendError(res, { code: 'UNAUTHORIZED', status: 401, message: 'Invalid session' }); return true; }
    // Optional: include refreshed token when requested or nearing expiry (sliding session)
    const { query } = parseUrl(req);
    const withToken = String(query.with_token || '0') === '1';
    let outToken: string | undefined;
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof (user as any).exp === 'number' ? (user as any).exp : 0;
    const nearExpiry = exp && (exp - now) < Math.max(60, Math.min(cfg.sessionTtlSec / 2, cfg.refreshSkewSec));
    if (withToken || nearExpiry) {
      const fresh = createSessionToken(user, cfg);
      setSessionCookie(res, cfg, fresh, cfg.sessionTtlSec);
      outToken = fresh;
    }
    try { validate(authMeResponseSchema, { ok: true, user, ...(outToken ? { token: outToken } : {}) }); } catch {}
    sendOk(res, { user, ...(outToken ? { token: outToken } : {}) });
    return true;
  }

  // POST /api/auth/logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    // Invalidate cookie client-side (stateless tokens). For stateful revoke, implement denylist.
    res.setHeader('Set-Cookie', `${cfg.cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` + (String(process.env.NODE_ENV).toLowerCase() === 'production' ? '; Secure' : ''));
    sendOk(res, {});
    return true;
  }

  return false;
}

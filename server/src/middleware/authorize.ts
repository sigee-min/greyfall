import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from '../config.js';
import { parseCookie } from '../auth/session.js';
import { verifyJwtHS256 } from '@shared/auth';

const ROLE_ORDER: Record<string, number> = { user: 1, admin: 2, sysadmin: 3 };

export function requireRole(minRole: 'user' | 'admin' | 'sysadmin') {
  return (req: IncomingMessage, res: ServerResponse, cfg: AppConfig): boolean => {
    const header = Array.isArray(req.headers['authorization']) ? req.headers['authorization'][0] : req.headers['authorization'];
    const bearer = header && /^Bearer\s+(.+)$/i.exec(header)?.[1];
    const cookie = parseCookie(req, cfg.cookieName);
    const token = bearer || cookie;
    if (!token) { res.statusCode = 401; res.end('Unauthorized'); return false; }
    const v = verifyJwtHS256(token, cfg.jwtSecret);
    if (!v.ok) { res.statusCode = 401; res.end('Unauthorized'); return false; }
    const role = String((v.payload as any).role || 'user').toLowerCase();
    const ok = (ROLE_ORDER[role] || 0) >= (ROLE_ORDER[minRole] || 9);
    if (!ok) { res.statusCode = 403; res.end('Forbidden'); return false; }
    return true;
  };
}


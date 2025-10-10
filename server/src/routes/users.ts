import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from '../config.js';
import { getUserProfile, setUserRole } from '../users/service.js';
import { getDb } from '../db/connection.js';
import { listUsers } from '../users/repo.js';
import { requireRole } from '../middleware/authorize.js';
import { parseCookie, verifySessionToken } from '../auth/session.js';
import { sendError, sendOk } from '../lib/http.js';

export async function handleUserRoutes(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith('/api/users/')) return false;
  const cfg = await loadConfig();

  if (pathname === '/api/users/me' && req.method === 'GET') {
    const bearer = Array.isArray(req.headers['authorization']) ? req.headers['authorization'][0] : req.headers['authorization'];
    const token = (bearer && /^Bearer\s+(.+)$/i.exec(bearer)?.[1]) || parseCookie(req, cfg.cookieName);
    if (!token) { sendError(res, { code: 'UNAUTHORIZED', status: 401, message: 'No session' }); return true; }
    const session = verifySessionToken(token, cfg);
    if (!session) { sendError(res, { code: 'UNAUTHORIZED', status: 401, message: 'Invalid session' }); return true; }
    const prof = await getUserProfile(cfg, session.sub);
    if (!prof) { sendError(res, { code: 'NOT_FOUND', status: 404, message: 'User not found' }); return true; }
    sendOk(res, { user: prof });
    return true;
  }

  // Admin: list users (sysadmin only)
  if (pathname === '/api/users' && req.method === 'GET') {
    if (!requireRole('sysadmin')(req, res, cfg)) return true;
    const url = new URL(req.url ?? '', 'http://localhost');
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
    const q = (url.searchParams.get('q') || '').trim();
    const sort = (url.searchParams.get('sort') || 'id').toLowerCase();
    const order = (url.searchParams.get('order') || 'asc').toLowerCase();
    const db = await getDb(cfg);
    const users = listUsers(db, limit, offset, {
      q: q || undefined,
      sort: (sort === 'name' || sort === 'role') ? (sort as any) : 'id',
      order: (order === 'desc' ? 'desc' : 'asc') as any
    });
    sendOk(res, { users, limit, offset, q, sort, order });
    return true;
  }

  // Sysadmin: update role of a user
  if (pathname.startsWith('/api/users/') && req.method === 'PATCH') {
    if (!requireRole('sysadmin')(req, res, cfg)) return true;
    const idRaw = pathname.split('/').pop() || '';
    const id = Number(idRaw);
    if (!Number.isFinite(id)) { sendError(res, { code: 'VALIDATION_ERROR', status: 400, message: 'Invalid user id' }); return true; }
    try {
      const body = await (async () => {
        try { return await (await import('../utils.js')).parseBody<any>(req); } catch { return null; }
      })();
      if (!body || typeof body !== 'object') { sendError(res, { code: 'VALIDATION_ERROR', status: 400, message: 'Invalid body' }); return true; }
      const role = String((body as any).role || '').toLowerCase();
      if (!['user', 'admin', 'sysadmin'].includes(role)) { sendError(res, { code: 'VALIDATION_ERROR', status: 400, message: 'Invalid role' }); return true; }
      let ok = false;
      try {
        ok = await setUserRole(cfg, id, role as any);
      } catch (e: any) {
        if (String(e?.code) === 'LAST_SYSADMIN') {
          sendError(res, { code: 'LAST_SYSADMIN', status: 409, message: 'Cannot demote the last sysadmin' });
          return true;
        }
        throw e;
      }
      if (!ok) { sendError(res, { code: 'NOT_FOUND', status: 404, message: 'User not found' }); return true; }
      sendOk(res, { id, role });
      return true;
    } catch (e: any) {
      sendError(res, { code: 'VALIDATION_ERROR', status: 400, details: e?.message || String(e) });
      return true;
    }
  }

  return false;
}

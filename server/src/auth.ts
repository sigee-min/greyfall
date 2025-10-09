import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from './config.js';

export function unauthorized(res: ServerResponse, realm = 'Greyfall-Logs') {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
}

export function checkBasicAuth(req: IncomingMessage, res: ServerResponse, config: AppConfig): boolean {
  if (!config.authEnabled) return true;
  const header = req.headers['authorization'] || '';
  const m = /^Basic\s+(?<token>[A-Za-z0-9+/=]+)$/.exec(Array.isArray(header) ? header[0] : header);
  if (!m || !m.groups?.token) return false;
  try {
    const decoded = Buffer.from(m.groups.token, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return false;
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    const expected = config.users[user];
    if (!expected) return false;
    // simple constant-time-ish compare
    return expected.length === pass.length && cryptoSafeEqual(expected, pass);
  } catch {
    return false;
  }
}

function cryptoSafeEqual(a: string, b: string): boolean {
  let result = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i) || 0;
    const cb = b.charCodeAt(i) || 0;
    result |= ca ^ cb;
  }
  return result === 0 && a.length === b.length;
}


import type { IncomingMessage, ServerResponse } from 'node:http';
import { parse as parseUrlLib } from 'node:url';

export function parseBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += String(chunk);
      if (data.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const json = data ? JSON.parse(data) : {};
        resolve(json as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function parseUrl(req: IncomingMessage) {
  const urlObj = parseUrlLib(req.url || '', true);
  return {
    pathname: urlObj.pathname || '/',
    query: urlObj.query as Record<string, string | undefined>,
  };
}

export function utcDateFolder(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function sanitizeType(type: string): string {
  return type.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function isIsoDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}


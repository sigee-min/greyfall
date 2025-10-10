import type { ServerResponse } from 'node:http';

export function sendOk<T extends Record<string, unknown>>(res: ServerResponse, payload: T, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, ...payload }));
}

export function sendError(
  res: ServerResponse,
  params: { code: string; status?: number; message?: string; details?: unknown }
) {
  const status = params.status ?? 400;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({ ok: false, error: { code: params.code, message: params.message ?? params.code }, details: params.details })
  );
}


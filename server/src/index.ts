import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { checkBasicAuth, unauthorized } from './auth.js';
import { LlmStorage } from './storage.js';
import { isIsoDateString, parseBody, parseUrl, sanitizeType, sendJson, utcDateFolder } from './utils.js';
import type { LlmLogInput, LlmLogRecord } from './types.js';

function notFound(res: ServerResponse) {
  sendJson(res, 404, { error: 'Not found', code: 'NOT_FOUND' });
}

function methodNotAllowed(res: ServerResponse) {
  sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
}

function escHtml(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function page(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
  :root{color-scheme:dark}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#0b0f15;color:#d8dee9}
  a{color:#81a1c1;text-decoration:none}
  header{position:sticky;top:0;background:#0d1117;border-bottom:1px solid #1f2937;padding:12px 16px}
  main{padding:16px;max-width:1100px;margin:0 auto}
  .card{border:1px solid #273244;background:#0f141b;border-radius:12px;padding:16px;margin:12px 0}
  input,select,button,textarea{background:#0d1117;color:#e5e7eb;border:1px solid #233041;border-radius:8px;padding:8px}
  button{cursor:pointer}
  code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#0b1220;color:#cbd5e1;border-radius:8px;padding:8px;display:block;overflow:auto}
  table{width:100%;border-collapse:collapse}
  th,td{border-bottom:1px solid #233041;padding:8px 10px;vertical-align:top}
  .muted{color:#94a3b8}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .actions{display:flex;gap:8px}
  </style></head>
  <body>
    <header><div class="row"><strong>Greyfall LLM Logs</strong> <a href="/dashboard" style="margin-left:12px">Dashboard</a> <a href="/api/dates" style="margin-left:12px">API</a></div></header>
    <main>${body}</main>
  </body></html>`;
}

function validateLogInput(obj: any): obj is LlmLogInput {
  return obj && typeof obj.request_id === 'string' && typeof obj.request_type === 'string' && typeof obj.input_text === 'string' && typeof obj.output_text === 'string';
}

async function main() {
  const cfg = await loadConfig();
  const storage = new LlmStorage(cfg);

  const server = http.createServer(async (req, res) => {
    try {
      // CORS (optional, simple default same-origin)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204; res.end(); return;
      }

      if (!checkBasicAuth(req, res, cfg)) {
        return unauthorized(res);
      }

      const { pathname, query } = parseUrl(req);

      // Determine dashboard base for link generation and route matching
      const isDash = (p: string) => p === '/dashboard' || p.startsWith('/dashboard/');
      const isDashAlt = (p: string) => p === '/server/dashboard' || p.startsWith('/server/dashboard/');
      const dashBase = isDashAlt(pathname) ? '/server/dashboard' : '/dashboard';

      // Dashboard (home)
      if (req.method === 'GET' && (pathname === '/' || pathname === '/dashboard' || pathname === '/server/dashboard')) {
        const body = `
          <div class="card">
            <h2>Getting started</h2>
            <p class="muted">POST <code>/api/llm/logs</code> with JSON or JSON[] to append logs.<br/>Use Basic Auth to access this dashboard and APIs.</p>
            <div class="actions"><a href="${dashBase}/dates">Browse dates →</a></div>
          </div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Greyfall Logs', body));
        return;
      }

      // Dashboard: dates
      if (req.method === 'GET' && (pathname === '/dashboard/dates' || pathname === '/server/dashboard/dates')) {
        const dates = await storage.listDates();
        const list = dates.map((d) => `<li><a href="${dashBase}/date/${d}">${escHtml(d)}</a></li>`).join('') || '<li class="muted">No data</li>';
        const body = `<div class="card"><h2>Dates</h2><ul>${list}</ul></div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Dates', body));
        return;
      }

      // Dashboard: types by date
      if (req.method === 'GET' && (pathname.startsWith('/dashboard/date/') || pathname.startsWith('/server/dashboard/date/'))) {
        const parts = pathname.split('/');
        const dateStr = decodeURIComponent(parts[parts.length - 1] || '');
        if (!isIsoDateString(dateStr)) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(page('Invalid date', `<div class="card">Invalid date: ${escHtml(dateStr)}</div>`));
          return;
        }
        const types = await storage.listTypes(dateStr);
        const items = types.map((t) => `<li><a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(t)}">${escHtml(t)}</a></li>`).join('') || '<li class="muted">No types</li>';
        const body = `<div class="card"><h2>Types for ${escHtml(dateStr)}</h2><ul>${items}</ul></div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page(`Types ${dateStr}`, body));
        return;
      }

      // Dashboard: logs list
      if (req.method === 'GET' && (pathname === '/dashboard/logs' || pathname === '/server/dashboard/logs')) {
        const dateStr = (query.date || '') as string;
        const type = (query.request_type || '') as string;
        const q = (query.q || '') as string;
        const pageNum = Math.max(1, Number(query.page || 1));
        const pageSize = Math.min(200, Math.max(1, Number(query.page_size || 50)));
        if (!isIsoDateString(dateStr) || !type) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(page('Missing params', `<div class="card">Missing date or request_type</div>`));
          return;
        }
        const records = await storage.readRecords(dateStr, type);
        const filtered = q ? records.filter((r) => (r.input_text && r.input_text.includes(q)) || (r.output_text && r.output_text.includes(q))) : records;
        const start = (pageNum - 1) * pageSize;
        const slice = filtered.slice(start, start + pageSize);
        const rows = slice.map((r) => {
          const snipIn = escHtml((r.input_text || '').slice(0, 220));
          const snipOut = escHtml((r.output_text || '').slice(0, 220));
          const link = `${dashBase}/logs/${encodeURIComponent(r.request_id)}?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}`;
          return `<tr><td><a href="${link}">${escHtml(r.request_id)}</a></td><td>${escHtml(String(r.rev))}</td><td class="muted">${escHtml(r.received_at || '')}</td><td><code>${snipIn}</code></td><td><code>${snipOut}</code></td></tr>`;
        }).join('');
        const body = `
          <div class="card">
            <h2>Logs ${escHtml(dateStr)} / ${escHtml(type)}</h2>
            <form class="row" method="get" action="/dashboard/logs">
              <input type="hidden" name="date" value="${escHtml(dateStr)}"/>
              <input type="hidden" name="request_type" value="${escHtml(type)}"/>
              <input type="text" name="q" placeholder="search text" value="${escHtml(q)}"/>
              <select name="page_size"><option ${pageSize===50?'selected':''} value="50">50</option><option ${pageSize===100?'selected':''} value="100">100</option><option ${pageSize===200?'selected':''} value="200">200</option></select>
              <button type="submit">Search</button>
              <a href="/api/download?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&format=ndjson">Download NDJSON</a>
            </form>
            <table><thead><tr><th>request_id</th><th>rev</th><th>received_at</th><th>input</th><th>output</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">No records</td></tr>'}</tbody></table>
            <div class="row">
              <a href="${dashBase}/date/${encodeURIComponent(dateStr)}">← Back</a>
              <div style="margin-left:auto" class="row">
                ${pageNum>1?`<a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&page=${pageNum-1}&page_size=${pageSize}">Prev</a>`:''}
                ${start+pageSize<filtered.length?`<a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&page=${pageNum+1}&page_size=${pageSize}">Next</a>`:''}
              </div>
            </div>
          </div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Logs', body));
        return;
      }

      // Dashboard: log detail
      if (req.method === 'GET' && (pathname.startsWith('/dashboard/logs/') || pathname.startsWith('/server/dashboard/logs/'))) {
        const id = decodeURIComponent(pathname.split('/').pop() || '');
        const dateStr = (query.date || '') as string;
        const type = (query.request_type || '') as string;
        if (!isIsoDateString(dateStr) || !type || !id) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(page('Missing params', `<div class="card">Missing date/request_type/id</div>`));
          return;
        }
        const records = await storage.readRecords(dateStr, type);
        const history = records.filter((r) => r.request_id === id).sort((a, b) => a.rev - b.rev);
        if (history.length === 0) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(page('Not found', `<div class="card">No records for id ${escHtml(id)}</div>`));
          return;
        }
        const latest = history[history.length - 1];
        const histHtml = history.map((h) => `<div class="card"><div class="muted">rev ${h.rev} • ${escHtml(h.op)} • ${escHtml(h.received_at||'')}</div><div><strong>input</strong><pre>${escHtml(h.input_text||'')}</pre></div><div><strong>output</strong><pre>${escHtml(h.output_text||'')}</pre></div></div>`).join('');
        const body = `
          <div class="card"><h2>${escHtml(id)}</h2>
            <div class="muted">Latest rev ${latest.rev} • type ${escHtml(type)} • date ${escHtml(dateStr)}</div>
            <div class="actions" style="margin:8px 0">
              <a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}">← Back to list</a>
              <a style="margin-left:auto" href="/api/llm/logs/${encodeURIComponent(id)}?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}">API JSON</a>
            </div>
          </div>
          ${histHtml}`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page(`Log ${id}`, body));
        return;
      }

      // Health
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, ts: Date.now() });
      }

      // Dates
      if (req.method === 'GET' && pathname === '/api/dates') {
        const list = await storage.listDates();
        return sendJson(res, 200, { dates: list });
      }

      // Types for date
      if (req.method === 'GET' && pathname === '/api/types') {
        const dateStr = (query.date || '') as string;
        if (!dateStr || !isIsoDateString(dateStr)) return sendJson(res, 400, { error: 'Invalid date', code: 'VALIDATION_ERROR' });
        const types = await storage.listTypes(dateStr);
        return sendJson(res, 200, { date: dateStr, types });
      }

      // Create/append logs
      if (req.method === 'POST' && pathname === '/api/llm/logs') {
        const body = await parseBody<any>(req);
        const items: LlmLogInput[] = Array.isArray(body) ? body : [body];
        const dateStr = utcDateFolder();
        const results = [] as { request_id: string; file: string; rev: number }[];
        for (const item of items) {
          if (!validateLogInput(item)) return sendJson(res, 400, { error: 'Invalid body', code: 'VALIDATION_ERROR' });
          const type = sanitizeType(item.request_type);
          // determine current rev using index
          const latest = await storage.getLatestIndex(dateStr, type, item.request_id);
          const nextRev = (latest?.rev || 0) + 1;
          const record: LlmLogRecord = { ...item, op: 'create', rev: nextRev, received_at: new Date().toISOString() };
          const r = await storage.append(dateStr, type, record);
          results.push({ request_id: item.request_id, file: r.file, rev: r.rev });
        }
        return sendJson(res, 200, { date: dateStr, results });
      }

      // Update
      if (pathname.startsWith('/api/llm/logs/') && req.method === 'PATCH') {
        const id = decodeURIComponent(pathname.split('/').pop() || '');
        const dateStr = (query.date as string) || utcDateFolder();
        const type = sanitizeType((query.request_type as string) || 'generic');
        const body = await parseBody<Partial<LlmLogInput>>(req);
        if (!id) return sendJson(res, 400, { error: 'Missing request_id', code: 'VALIDATION_ERROR' });
        const latest = await storage.getLatestIndex(dateStr, type, id);
        const nextRev = (latest?.rev || 0) + 1;
        const record: LlmLogRecord = {
          request_id: id,
          request_type: type,
          input_text: body.input_text ?? '',
          output_text: body.output_text ?? '',
          client_at: body.client_at,
          model: body.model,
          temperature: body.temperature,
          top_p: body.top_p,
          seed: body.seed,
          meta: body.meta,
          op: 'update',
          rev: nextRev,
          received_at: new Date().toISOString(),
        };
        const r = await storage.append(dateStr, type, record);
        return sendJson(res, 200, { date: dateStr, request_id: id, file: r.file, rev: r.rev });
      }

      // Delete (tombstone)
      if (pathname.startsWith('/api/llm/logs/') && req.method === 'DELETE') {
        const id = decodeURIComponent(pathname.split('/').pop() || '');
        const dateStr = (query.date as string) || utcDateFolder();
        const type = sanitizeType((query.request_type as string) || 'generic');
        if (!id) return sendJson(res, 400, { error: 'Missing request_id', code: 'VALIDATION_ERROR' });
        const latest = await storage.getLatestIndex(dateStr, type, id);
        const nextRev = (latest?.rev || 0) + 1;
        const record: LlmLogRecord = {
          request_id: id,
          request_type: type,
          input_text: '',
          output_text: '',
          op: 'delete',
          rev: nextRev,
          received_at: new Date().toISOString(),
        } as LlmLogRecord;
        const r = await storage.append(dateStr, type, record);
        return sendJson(res, 200, { date: dateStr, request_id: id, file: r.file, rev: r.rev });
      }

      // Read list
      if (pathname === '/api/llm/logs' && req.method === 'GET') {
        const dateStr = (query.date || '') as string;
        const type = (query.request_type || '') as string;
        const q = (query.q || '') as string;
        const page = Number(query.page || 1);
        const pageSize = Math.min(500, Math.max(1, Number(query.page_size || 50)));
        if (!isIsoDateString(dateStr)) return sendJson(res, 400, { error: 'Invalid date', code: 'VALIDATION_ERROR' });
        if (!type) return sendJson(res, 400, { error: 'Missing request_type', code: 'VALIDATION_ERROR' });
        const records = await storage.readRecords(dateStr, type);
        const filtered = q
          ? records.filter((r) => (r.input_text && r.input_text.includes(q)) || (r.output_text && r.output_text.includes(q)))
          : records;
        const start = (page - 1) * pageSize;
        const slice = filtered.slice(start, start + pageSize);
        return sendJson(res, 200, { total: filtered.length, page, page_size: pageSize, items: slice });
      }

      // Read by id (date required)
      if (pathname.startsWith('/api/llm/logs/') && req.method === 'GET') {
        const id = decodeURIComponent(pathname.split('/').pop() || '');
        const dateStr = (query.date || '') as string;
        const type = (query.request_type || '') as string;
        if (!isIsoDateString(dateStr) || !type) return sendJson(res, 400, { error: 'Missing date or request_type', code: 'VALIDATION_ERROR' });
        const records = await storage.readRecords(dateStr, type);
        const history = records.filter((r) => r.request_id === id).sort((a, b) => a.rev - b.rev);
        if (history.length === 0) return notFound(res);
        // merge to latest
        const latest = history[history.length - 1];
        return sendJson(res, 200, { id, date: dateStr, type, latest, history });
      }

      // Download export
      if (pathname === '/api/download' && req.method === 'GET') {
        const dateStr = (query.date || '') as string;
        const type = (query.request_type || '') as string;
        const format = ((query.format || 'ndjson') as string).toLowerCase();
        if (!isIsoDateString(dateStr) || !type) return sendJson(res, 400, { error: 'Missing date or request_type', code: 'VALIDATION_ERROR' });
        const records = await storage.readRecords(dateStr, type);
        if (format === 'json') {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(type)}-${encodeURIComponent(dateStr)}.json"`,
          });
          res.end(JSON.stringify(records));
        } else {
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(type)}-${encodeURIComponent(dateStr)}.ndjson"`,
          });
          for (const r of records) {
            res.write(JSON.stringify(r) + '\n');
          }
          res.end();
        }
        return;
      }

      // Fallback
      notFound(res);
    } catch (err: any) {
      console.error('[server] error', err);
      sendJson(res, 500, { error: 'Internal error', code: 'INTERNAL', message: String(err?.message || err) });
    }
  });

  server.listen(cfg.port, () => {
    console.log(`[server] listening on http://localhost:${cfg.port}`);
    console.log(`[server] data root: ${cfg.dataRoot}`);
  });
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

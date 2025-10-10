import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { checkAuthUnified } from './middleware/auth.js';
import { handleAuthRoutes } from './routes/auth.js';
import { sendError } from './lib/http.js';
import { validate } from './lib/validate.js';
import { llmLogCreateSchema, llmLogCreateBatchSchema, typesQuerySchema, logsListQuerySchema, logsReadByIdQuerySchema, downloadQuerySchema, logsUpdateQuerySchema, logsDeleteQuerySchema, llmLogUpdateBodySchema } from '@shared/protocol';
import { LlmStorage } from './storage.js';
import { logger, genRequestId } from './lib/logger.js';
import { attachContext } from './middleware/ctx.js';
import { isIsoDateString, parseBody, parseUrl, sanitizeType, sendJson, utcDateFolder } from './utils.js';
import { route } from './lib/route.js';
import type { LlmLogInput, LlmLogRecord, ChatMessage } from './types.js';

function notFound(res: ServerResponse) {
  sendError(res, { code: 'NOT_FOUND', status: 404, message: 'Not found' });
}

function methodNotAllowed(res: ServerResponse) {
  sendError(res, { code: 'METHOD_NOT_ALLOWED', status: 405, message: 'Method not allowed' });
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

function isAllowedRole(r: unknown): r is ChatMessage['role'] {
  return r === 'system' || r === 'user' || r === 'assistant';
}

function validateMessages(messages: any): { ok: true } | { ok: false; code: string; reason: string } {
  if (!Array.isArray(messages)) return { ok: false, code: 'VALIDATION_ERROR', reason: 'messages not array' };
  const msgs: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { ok: false, code: 'VALIDATION_ERROR', reason: 'message not object' };
    const role = (m as any).role;
    const content = (m as any).content;
    if (!isAllowedRole(role)) return { ok: false, code: 'UNSUPPORTED_ROLE', reason: 'unsupported role' };
    if (typeof content !== 'string' || !content.trim()) return { ok: false, code: 'VALIDATION_ERROR', reason: 'empty content' };
    msgs.push({ role, content: String(content) });
  }
  if (msgs.length === 0) return { ok: false, code: 'VALIDATION_ERROR', reason: 'empty messages' };
  // system 0~1 at head only
  const hasSystem = msgs[0]?.role === 'system';
  for (let i = 1; i < msgs.length; i += 1) {
    if (msgs[i].role === 'system') return { ok: false, code: 'TURN_ORDER_ERROR', reason: 'system must be at head only' };
  }
  // alternate user/assistant
  let idx = hasSystem ? 1 : 0;
  if (idx >= msgs.length) return { ok: false, code: 'VALIDATION_ERROR', reason: 'no turns' };
  if (msgs[idx].role !== 'user') return { ok: false, code: 'TURN_ORDER_ERROR', reason: 'first turn must be user' };
  let seenUser = false; let seenAssistant = false;
  for (let i = idx; i < msgs.length; i += 1) {
    const expect: ChatMessage['role'] = (i - idx) % 2 === 0 ? 'user' : 'assistant';
    if (msgs[i].role !== expect) return { ok: false, code: 'TURN_ORDER_ERROR', reason: `expected ${expect} at index ${i}` };
    if (msgs[i].role === 'user') seenUser = true; else if (msgs[i].role === 'assistant') seenAssistant = true;
  }
  if (!seenUser || !seenAssistant) return { ok: false, code: 'VALIDATION_ERROR', reason: 'must include user and assistant' };
  return { ok: true };
}

function coerceCanonicalMessages(obj: any): { ok: true; messages: ChatMessage[] } | { ok: false; code: string; reason: string } {
  if (Array.isArray(obj?.messages)) {
    const v = validateMessages(obj.messages);
    if (!v.ok) return v;
    return { ok: true, messages: obj.messages as ChatMessage[] };
  }
  return { ok: false, code: 'VALIDATION_ERROR', reason: 'missing messages' };
}

function recordLastRoleText(r: LlmLogRecord, role: 'user' | 'assistant'): string {
  const msgs = Array.isArray((r as any).messages) ? (r as any).messages as ChatMessage[] : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i]?.role === role) return String(msgs[i]?.content || '');
  }
  return '';
}

function recordMatchesQuery(r: LlmLogRecord, q: string): boolean {
  const query = q.trim();
  if (!query) return true;
  const msgs = Array.isArray((r as any).messages) ? (r as any).messages as ChatMessage[] : [];
  for (const m of msgs) {
    if ((m.role === 'user' || m.role === 'assistant') && m.content && m.content.includes(query)) return true;
  }
  return false;
}

function isCompleteConversation(messages: ChatMessage[]): boolean {
  let hasUser = false; let hasAssistant = false;
  for (const m of messages) { if (m.role === 'user') hasUser = true; if (m.role === 'assistant') hasAssistant = true; }
  return hasUser && hasAssistant;
}

function trimMessages(messages: ChatMessage[], maxTurns: number | null): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const out: ChatMessage[] = [];
  let start = 0;
  if (messages[0]?.role === 'system') { out.push(messages[0]); start = 1; }
  if (!maxTurns || maxTurns <= 0) return [...messages];
  // collect user/assistant pairs
  const pairs: { user: ChatMessage; assistant: ChatMessage }[] = [];
  for (let i = start; i < messages.length; i += 2) {
    const user = messages[i];
    const assistant = messages[i + 1];
    if (!user || !assistant) break;
    if (user.role !== 'user' || assistant.role !== 'assistant') break;
    pairs.push({ user, assistant });
  }
  const take = Math.max(1, Math.min(maxTurns, pairs.length));
  const slice = pairs.slice(-take);
  for (const p of slice) { out.push(p.user, p.assistant); }
  return out;
}

async function main() {
  const cfg = await loadConfig();
  const storage = new LlmStorage(cfg);

  const server = http.createServer(async (req, res) => {
    const reqId = genRequestId();
    const startedAt = Date.now();
    let pathForLog = '';
    res.on('finish', () => {
      const ms = Date.now() - startedAt;
      logger.info('http', { reqId, method: req.method, path: pathForLog || req.url, status: res.statusCode, ms });
    });
    try {
      attachContext(req, { reqId, startedAt });
      // CORS (optional, simple default same-origin)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204; res.end(); return;
      }

      const { pathname, query } = parseUrl(req);
      pathForLog = pathname;

      // Open endpoints (no auth): ingest, health, and auth routes
      const isOpenIngest = req.method === 'POST' && pathname === '/api/llm/logs';
      const isHealth = req.method === 'GET' && pathname === '/api/health';
      const isAuth = pathname.startsWith('/api/auth/');
      if (isAuth) {
        const handled = await handleAuthRoutes(req, res, pathname);
        if (handled) return;
      }
      if (!isOpenIngest && !isHealth && !isAuth) {
        const auth = checkAuthUnified(req, res, cfg);
        if (!auth.ok) return; // response already sent
      }

      // Dashboard base path
      const isDash = (p: string) => p === '/dashboard' || p.startsWith('/dashboard/');
      const dashBase = '/dashboard';

      // Dashboard (home)
      if (req.method === 'GET' && (pathname === '/' || pathname === '/dashboard')) {
        const body = `
          <div class="card">
            <h2>Getting started</h2>
            <p class="muted">POST <code>/api/llm/logs</code> with JSON (or JSON[]) using canonical <code>{ messages:[{role,content}] }</code> schema.<br/>Sign in to access this dashboard and APIs. Export TRAIN-JSONL with <code>/api/download?format=train-jsonl</code>.</p>
            <div class="actions"><a href="${dashBase}/dates">Browse dates →</a></div>
          </div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Greyfall Logs', body));
        return;
      }

      // Dashboard: dates
      if (req.method === 'GET' && pathname === '/dashboard/dates') {
        const dates = await storage.listDates();
        const list = dates.map((d) => `<li><a href="${dashBase}/date/${d}">${escHtml(d)}</a></li>`).join('') || '<li class="muted">No data</li>';
        const body = `<div class="card"><h2>Dates</h2><ul>${list}</ul></div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Dates', body));
        return;
      }

      // Dashboard: types by date
      if (req.method === 'GET' && pathname.startsWith('/dashboard/date/')) {
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
      if (req.method === 'GET' && pathname === '/dashboard/logs') {
        const dateStr = (query.date || '') as string;
        const type = (query.request_type || '') as string;
        const q = (query.q || '') as string;
        const pageNum = Math.max(1, Number(query.page || 1));
        const pageSize = Math.min(200, Math.max(1, Number(query.page_size || 50)));
        const onlyComplete = String(query.complete || '0') === '1';
        const latestOnly = String(query.latest || '0') === '1';
        if (!isIsoDateString(dateStr) || !type) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(page('Missing params', `<div class="card">Missing date or request_type</div>`));
          return;
        }
        const records = await storage.readRecords(dateStr, type);
        let filtered = q ? records.filter((r) => recordMatchesQuery(r, q)) : records;
        if (onlyComplete) {
          filtered = filtered.filter((r) => Array.isArray((r as any).messages) && isCompleteConversation((r as any).messages as ChatMessage[]));
        }
        if (latestOnly) {
          const groups = new Map<string, typeof filtered>();
          for (const r of filtered) {
            const arr = (groups.get(r.request_id) || []) as typeof filtered;
            (arr as any).push(r);
            groups.set(r.request_id, arr);
          }
          const latest: typeof filtered = [] as any;
          for (const arr of groups.values()) {
            const s = (arr as any).slice().sort((a: any, b: any) => a.rev - b.rev);
            latest.push(s[s.length - 1]);
          }
          filtered = latest;
        }
        const start = (pageNum - 1) * pageSize;
        const slice = filtered.slice(start, start + pageSize);
        const rows = slice.map((r) => {
          const snipIn = escHtml(recordLastRoleText(r, 'user').slice(0, 220));
          const snipOut = escHtml(recordLastRoleText(r, 'assistant').slice(0, 220));
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
              <label class="row" style="gap:6px"><input type="checkbox" name="complete" value="1" ${onlyComplete?'checked':''}/> Only complete</label>
              <label class="row" style="gap:6px"><input type="checkbox" name="latest" value="1" ${latestOnly?'checked':''}/> Latest only</label>
              <button type="submit">Search</button>
              <a href="/api/download?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&format=ndjson">Download NDJSON</a>
              <a href="/api/download?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&format=train-jsonl&latest=${latestOnly?'1':'0'}&filter=${onlyComplete?'complete':'all'}">Download TRAIN-JSONL</a>
            </form>
            <table><thead><tr><th>request_id</th><th>rev</th><th>received_at</th><th>input</th><th>output</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">No records</td></tr>'}</tbody></table>
            <div class="row">
              <a href="${dashBase}/date/${encodeURIComponent(dateStr)}">← Back</a>
              <div style="margin-left:auto" class="row">
                ${pageNum>1?`<a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&complete=${onlyComplete?'1':'0'}&latest=${latestOnly?'1':'0'}&page=${pageNum-1}&page_size=${pageSize}">Prev</a>`:''}
                ${start+pageSize<filtered.length?`<a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}&complete=${onlyComplete?'1':'0'}&latest=${latestOnly?'1':'0'}&page=${pageNum+1}&page_size=${pageSize}">Next</a>`:''}
              </div>
            </div>
          </div>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('Logs', body));
        return;
      }

      // Dashboard: log detail
      if (req.method === 'GET' && pathname.startsWith('/dashboard/logs/')) {
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
        const histHtml = history.map((h) => {
          const msgs = Array.isArray((h as any).messages) ? (h as any).messages as ChatMessage[] : [];
          let bodyHtml = '';
          if (msgs.length > 0) {
            const parts = msgs.map((m) => {
              const label = m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant';
              return `<div><div class="muted">${escHtml(label)}</div><pre>${escHtml(m.content || '')}</pre></div>`;
            }).join('');
            bodyHtml = parts;
          }
          return `<div class="card"><div class="muted">rev ${h.rev} • ${escHtml(h.op)} • ${escHtml(h.received_at||'')}</div>${bodyHtml}</div>`;
        }).join('');
        const body = `
          <div class="card"><h2>${escHtml(id)}</h2>
            <div class="muted">Latest rev ${latest.rev} • type ${escHtml(type)} • date ${escHtml(dateStr)}</div>
            <div class="actions" style="margin:8px 0">
              <a href="${dashBase}/logs?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}">← Back to list</a>
              <a style="margin-left:auto" href="/api/llm/logs/${encodeURIComponent(id)}?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}">API JSON</a>
              <a href="/api/download?date=${encodeURIComponent(dateStr)}&request_type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&format=train-jsonl&latest=1&filter=complete">Export TRAIN-JSONL</a>
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
        return sendJson(res, 200, { ok: true, dates: list });
      }

      // Types for date (route wrapper)
      if (await route(req, res, { pathname, query }, { method: 'GET', path: '/api/types', querySchema: typesQuerySchema }, async ({ query: qv }) => {
        const dateStr = (qv as any).date as string;
        const types = await storage.listTypes(dateStr);
        sendJson(res, 200, { ok: true, date: dateStr, types });
      })) return;

      // Create/append logs (route wrapper)
      if (await route(
        req,
        res,
        { pathname, query },
        { method: 'POST', path: '/api/llm/logs', bodySchema: llmLogCreateBatchSchema },
        async ({ body }) => {
          const items: any[] = Array.isArray(body) ? (body as any[]) : [body];
          const dateStr = utcDateFolder();
          const results = [] as { request_id: string; file: string; rev: number }[];
          for (const raw of items) {
            const canon = coerceCanonicalMessages(raw);
            if (!canon.ok) { sendError(res, { code: canon.code, status: 400, message: canon.reason }); return; }
            const type = sanitizeType(raw.request_type);
            const latest = await storage.getLatestIndex(dateStr, type, raw.request_id);
            const nextRev = (latest?.rev || 0) + 1;
            const record: LlmLogRecord = {
              request_id: raw.request_id,
              request_type: type,
              messages: canon.messages,
              client_at: raw.client_at,
              model: raw.model,
              temperature: raw.temperature,
              top_p: raw.top_p,
              seed: raw.seed,
              meta: raw.meta,
              op: 'create',
              rev: nextRev,
              received_at: new Date().toISOString()
            };
            const r = await storage.append(dateStr, type, record);
            results.push({ request_id: raw.request_id, file: r.file, rev: r.rev });
          }
          sendJson(res, 200, { ok: true, date: dateStr, results });
        }
      )) return;

      // Update (replace snapshot semantics) via route wrapper
      if (await route(
        req,
        res,
        { pathname, query },
        { method: 'PATCH', path: (p) => p.startsWith('/api/llm/logs/'), querySchema: logsUpdateQuerySchema, bodySchema: llmLogUpdateBodySchema },
        async ({ query: qv, ctx, body }) => {
          const id = decodeURIComponent(ctx.pathname.split('/').pop() || '');
          if (!id) { sendError(res, { code: 'VALIDATION_ERROR', status: 400, message: 'Missing request_id' }); return; }
          const dateStr = ((qv as any).date as string) || utcDateFolder();
          const type = sanitizeType((((qv as any).request_type as string) || 'generic'));
          const canon = coerceCanonicalMessages(body as any);
          if (!canon.ok) { sendError(res, { code: canon.code, status: 400, message: canon.reason }); return; }
          const latest = await storage.getLatestIndex(dateStr, type, id);
          const nextRev = (latest?.rev || 0) + 1;
          const record: LlmLogRecord = {
            request_id: id,
            request_type: type,
            messages: canon.messages,
            client_at: (body as any).client_at,
            model: (body as any).model,
            temperature: (body as any).temperature,
            top_p: (body as any).top_p,
            seed: (body as any).seed,
            meta: (body as any).meta,
            op: 'update',
            rev: nextRev,
            received_at: new Date().toISOString(),
          };
          const r = await storage.append(dateStr, type, record);
          sendJson(res, 200, { ok: true, date: dateStr, request_id: id, file: r.file, rev: r.rev });
        }
      )) return;

      // Delete (tombstone) via route wrapper
      if (await route(
        req,
        res,
        { pathname, query },
        { method: 'DELETE', path: (p) => p.startsWith('/api/llm/logs/'), querySchema: logsDeleteQuerySchema },
        async ({ query: qv, ctx }) => {
          const id = decodeURIComponent(ctx.pathname.split('/').pop() || '');
          if (!id) { sendError(res, { code: 'VALIDATION_ERROR', status: 400, message: 'Missing request_id' }); return; }
          const dateStr = ((qv as any).date as string) || utcDateFolder();
          const type = sanitizeType((((qv as any).request_type as string) || 'generic'));
          const latest = await storage.getLatestIndex(dateStr, type, id);
          const nextRev = (latest?.rev || 0) + 1;
          const record: LlmLogRecord = {
            request_id: id,
            request_type: type,
            messages: [],
            op: 'delete',
            rev: nextRev,
            received_at: new Date().toISOString(),
          } as LlmLogRecord;
          const r = await storage.append(dateStr, type, record);
          sendJson(res, 200, { ok: true, date: dateStr, request_id: id, file: r.file, rev: r.rev });
        }
      )) return;

      // Read list (route wrapper)
      if (await route(
        req,
        res,
        { pathname, query },
        { method: 'GET', path: '/api/llm/logs', querySchema: logsListQuerySchema },
        async ({ query: qv }) => {
          const dateStr = (qv as any).date as string;
          const type = (qv as any).request_type as string;
          const qtext = ((qv as any).q || '') as string;
          const page = ((qv as any).page ?? 1) as number;
          const pageSize = ((qv as any).page_size ?? 50) as number;
          const records = await storage.readRecords(dateStr, type);
          const filtered = qtext ? records.filter((r) => recordMatchesQuery(r, qtext)) : records;
          const start = (page - 1) * pageSize;
          const slice = filtered.slice(start, start + pageSize);
          sendJson(res, 200, { ok: true, total: filtered.length, page, page_size: pageSize, items: slice });
        }
      )) return;

      // Read by id (route wrapper)
      if (await route(
        req,
        res,
        { pathname, query },
        { method: 'GET', path: (p) => p.startsWith('/api/llm/logs/'), querySchema: logsReadByIdQuerySchema },
        async ({ query: qv, ctx }) => {
          const id = decodeURIComponent(ctx.pathname.split('/').pop() || '');
          const records = await storage.readRecords((qv as any).date, (qv as any).request_type);
          const history = records.filter((r) => r.request_id === id).sort((a, b) => a.rev - b.rev);
          if (history.length === 0) { notFound(res); return; }
          const latest = history[history.length - 1];
          sendJson(res, 200, { ok: true, id, date: (qv as any).date, type: (qv as any).request_type, latest, history });
        }
      )) return;

      // Download export (route wrapper)
      if (await route(
        req,
        res,
        { pathname, query },
        { method: 'GET', path: '/api/download', querySchema: downloadQuerySchema },
        async ({ query: qv }) => {
          const dateStr = (qv as any).date as string;
          const type = (qv as any).request_type as string;
          const format = (((qv as any).format ?? 'ndjson') as string).toLowerCase();
          let records = await storage.readRecords(dateStr, type);
          const idFilter = ((qv as any).id || '') as string;
          if (idFilter) records = records.filter((r) => r.request_id === idFilter);
          if (format === 'json') {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(type)}-${encodeURIComponent(dateStr)}.json"`,
            });
            res.end(JSON.stringify(records));
          } else if (format === 'train-jsonl') {
            // Options: latest=1|0, filter=complete|all, max_turns?
          const latestOnly = (((qv as any).latest ?? '1') as string) === '1';
          const filterMode = String((qv as any).filter ?? 'complete');
          const maxTurns = typeof (qv as any).max_turns === 'number' ? ((qv as any).max_turns as number) : null;
            // group by request_id
            const groups = new Map<string, LlmLogRecord[]>();
            for (const r of records) {
              const arr = groups.get(r.request_id) || [];
              arr.push(r);
              groups.set(r.request_id, arr);
            }
          const latestRecords: LlmLogRecord[] = [];
          if (latestOnly) {
            for (const arr of groups.values()) {
              const sorted = arr.slice().sort((a, b) => a.rev - b.rev);
              latestRecords.push(sorted[sorted.length - 1]);
            }
          } else {
            for (const arr of groups.values()) latestRecords.push(...arr);
          }
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(type)}-${encodeURIComponent(dateStr)}.train.jsonl"`,
          });
          for (const r of latestRecords) {
            const canon = coerceCanonicalMessages(r);
            if (!canon.ok) continue;
            let msgs = canon.messages;
            if (filterMode === 'complete' && !isCompleteConversation(msgs)) continue;
            if (maxTurns) msgs = trimMessages(msgs, maxTurns);
            res.write(JSON.stringify({ messages: msgs }) + '\n');
          }
          res.end();
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
        }
      )) return;

      // Fallback
      notFound(res);
    } catch (err: any) {
      logger.error('http-error', { reqId, path: pathForLog || req.url, error: String(err?.message || err) });
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

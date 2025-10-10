// Basic contract tests for open endpoints.
// Requires: Node 20+ (built-in fetch, node:test)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 18080 + Math.floor(Math.random() * 2000);
const BASE = `http://localhost:${PORT}`;

const TMP = mkdtempSync(join(tmpdir(), 'greyfall-tests-'));
let child;

async function waitForReady(timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

test('contract suite', { timeout: 20000 }, async (t) => {
  child = spawn('node', ['dist/index.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      DATA_ROOT: TMP,
      JWT_SECRET: 'test-secret',
      GOOGLE_CLIENT_ID: 'test-client-id'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (c) => process.stdout.write(`[server] ${c}`));
  child.stderr.on('data', (c) => process.stderr.write(`[server] ${c}`));
  t.after(() => {
    try { child?.kill('SIGKILL'); } catch {}
    try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  });

  const ok = await waitForReady(8000);
  assert.equal(ok, true, 'server should be ready');

  await t.test('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  });

  await t.test('POST /api/auth/google/signin without credential → 400', async () => {
    const res = await fetch(`${BASE}/api/auth/google/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.ok, false);
  });

  await t.test('POST /api/llm/logs invalid body → 400', async () => {
    const res = await fetch(`${BASE}/api/llm/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bad: 'payload' })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.ok, false);
  });
});

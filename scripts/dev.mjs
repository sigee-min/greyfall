#!/usr/bin/env node
import { spawn } from 'node:child_process';

function parseTargetArg() {
  const direct = process.argv.slice(2).filter(Boolean);
  if (direct.length > 0) return direct[0];
  try {
    const raw = process.env.npm_config_argv;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    // Prefer remain; fallback to original array after 'dev'
    if (Array.isArray(parsed.remain) && parsed.remain.length > 0) {
      return parsed.remain[0];
    }
    if (Array.isArray(parsed.original)) {
      const idx = parsed.original.indexOf('dev');
      if (idx !== -1 && parsed.original[idx + 1]) return parsed.original[idx + 1];
      // grab last non-flag token that isn't 'run'
      const last = parsed.original.filter((t) => t && t !== 'run' && !t.startsWith('-')).slice(-1)[0];
      return last;
    }
  } catch {}
  return undefined;
}

function printHelp() {
  console.log('Usage: npm run dev <target>');
  console.log('Targets:');
  console.log('  client     Start Vite dev server');
  console.log('  server     Start API server (watch) + shared');
  console.log('  signal     Start signaling server (watch) + shared');
  console.log('  shared     Watch shared packages (@shared/protocol, @shared/auth)');
  console.log('  protocol   Watch @shared/protocol only');
  console.log('  auth       Watch @shared/auth only');
  console.log('  all        Start shared + server + signal + client');
  console.log('  help       Show this help');
}

/** Spawn an npm workspace script */
function run(workspace, script = 'dev') {
  return spawn('npm', ['-w', workspace, 'run', script], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
}

/** Exec a binary within a workspace (npm exec), optionally with extra env */
function execBin(workspace, bin, args = [], extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  return spawn('npm', ['-w', workspace, 'exec', bin, '--', ...args], {
    stdio: 'inherit',
    shell: true,
    env,
  });
}

/** Run multiple processes concurrently and handle cleanup */
function runMany(tasks) {
  const children = tasks.map((t) => t());
  const killAll = () => {
    for (const c of children) {
      if (c && c.pid) {
        try { process.kill(c.pid); } catch {}
      }
    }
  };
  process.on('SIGINT', () => { killAll(); process.exit(130); });
  process.on('SIGTERM', () => { killAll(); process.exit(143); });
  // If any child exits, just keep process alive; user can Ctrl+C
  children.forEach((c) => c.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev] subprocess exited with code ${code}`);
    }
  }));
}

async function waitFor(url, { timeoutMs = 20000, intervalMs = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

const target = (parseTargetArg() || '').toLowerCase();

switch (target) {
  case 'client':
    console.log('[dev] starting: shared -> client');
    runMany([
      () => run('shared/protocol', 'dev'),
      () => run('shared/auth', 'dev'),
      () => run('client', 'dev'),
    ]);
    break;
  case 'server':
    console.log('[dev] starting: shared -> server');
    runMany([
      () => run('shared/protocol', 'dev'),
      () => run('shared/auth', 'dev'),
      () => run('server', 'dev'),
    ]);
    break;
  case 'signal':
    console.log('[dev] starting: shared -> signal');
    runMany([
      () => run('shared/protocol', 'dev'),
      () => run('shared/auth', 'dev'),
      // Use npm exec to resolve hoisted tsx; preload dotenv via NODE_OPTIONS
      () => execBin('signal', 'tsx', ['watch', 'src/index.ts'], { NODE_OPTIONS: '--import=dotenv/config' }),
    ]);
    break;
  case 'shared':
    console.log('[dev] starting: shared packages');
    runMany([
      () => run('shared/protocol', 'dev'),
      () => run('shared/auth', 'dev'),
    ]);
    break;
  case 'protocol':
    run('shared/protocol', 'dev');
    break;
  case 'auth':
    run('shared/auth', 'dev');
    break;
  case 'all':
    console.log('[dev] starting: shared + server + signal + client');
    // Start shared + server + signal immediately, then start client once server exposes /api/config
    (async () => {
      const children = [];
      const add = (c) => { if (c) { children.push(c); c.on('exit', (code) => { if (code && code !== 0) console.error(`[dev] subprocess exited with code ${code}`); }); } };
      const killAll = () => { for (const c of children) { try { if (c?.pid) process.kill(c.pid); } catch {} } };
      process.on('SIGINT', () => { killAll(); process.exit(130); });
      process.on('SIGTERM', () => { killAll(); process.exit(143); });

      add(run('shared/protocol', 'dev'));
      add(run('shared/auth', 'dev'));
      add(run('server', 'dev'));
      add(execBin('signal', 'tsx', ['watch', 'src/index.ts'], { NODE_OPTIONS: '--import=dotenv/config' }));

      const ok = await waitFor('http://localhost:8080/api/config', { timeoutMs: 20000, intervalMs: 300 });
      if (!ok) console.warn('[dev] timed out waiting for /api/config; client may start with login disabled until server is ready');
      add(run('client', 'dev'));
    })();
    break;
  case '':
  case 'help':
  default:
    printHelp();
    if (!target) process.exit(1);
}

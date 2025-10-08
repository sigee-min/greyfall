#!/usr/bin/env node
// Benchmark report for SFT datasets: per-task pass rate, common distributions, and length stats.
// Usage: node scripts/ft-bench.mjs [baseDir=docs/fine-tuning/data/v1]

import fs from 'fs';
import path from 'path';
import { validate as _validate } from './ft-validate.mjs';

const BASE = process.argv[2] || 'docs/fine-tuning/data/v1';

function listFiles(dir) { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f)); }
function* iter(file) { const data = fs.readFileSync(file, 'utf8'); for (const l of data.split(/\r?\n/)) { const t = l.trim(); if (t) yield t; } }

function charLen(s) { return String(s||'').length; }

function benchSplit(dir, label) {
  const files = listFiles(dir);
  const report = {};
  for (const file of files) {
    const task = path.basename(file, '.jsonl');
    const r = report[task] || (report[task] = { total: 0, pass: 0, fail: 0, fails: {}, stats: {} });
    for (const line of iter(file)) {
      r.total += 1; let obj; try { obj = JSON.parse(line); } catch { r.fail += 1; r.fails.json = (r.fails.json||0)+1; continue; }
      const errs = _validate(String(obj?.meta?.task || task), obj);
      if (errs.length) { r.fail += 1; for (const e of errs) r.fails[e] = (r.fails[e]||0)+1; continue; }
      r.pass += 1;
      // Task-specific stats
      switch (task) {
        case 'intent.plan': {
          const a = String(obj.output?.action || ''); r.stats.actions = r.stats.actions || {}; r.stats.actions[a] = (r.stats.actions[a]||0)+1;
          const tgt = Array.isArray(obj.output?.targets) ? obj.output.targets.length : 0; r.stats.targets = (r.stats.targets||0)+tgt;
          const hasItem = typeof obj.output?.item === 'string'; r.stats.itemCount = (r.stats.itemCount||0)+(hasItem?1:0);
          break; }
        case 'result.narrate': {
          const len = charLen(obj.output); r.stats.len = (r.stats.len||0)+len; r.stats.count = (r.stats.count||0)+1; break; }
        case 'intent.disambiguate': {
          const n = Array.isArray(obj.output?.options) ? obj.output.options.length : 0; r.stats.opt = (r.stats.opt||0)+n; r.stats.count = (r.stats.count||0)+1; break; }
        case 'entity.link': {
          const n = Array.isArray(obj.output?.refs) ? obj.output.refs.length : 0; r.stats.refs = (r.stats.refs||0)+n; r.stats.count = (r.stats.count||0)+1; break; }
        case 'safety.screen': {
          r.stats.flag = (r.stats.flag||0)+ (obj.output?.flag ? 1 : 0);
          const reasons = Array.isArray(obj.output?.reasons) ? obj.output.reasons : []; r.stats.reasons = r.stats.reasons || {}; for (const rs of reasons) r.stats.reasons[rs] = (r.stats.reasons[rs]||0)+1; break; }
        case 'chat': {
          const len = charLen(obj.output); r.stats.len = (r.stats.len||0)+len; r.stats.count = (r.stats.count||0)+1; break; }
        default: break;
      }
    }
  }
  console.log(`\n=== Bench: ${label} (${dir}) ===`);
  for (const [task, r] of Object.entries(report)) {
    const pct = r.total ? ((r.pass/r.total)*100).toFixed(1) : 'n/a';
    console.log(`${task.padEnd(20)} ${String(r.pass).padStart(5)}/${String(r.total).padEnd(5)} (${pct}%)`);
    if (Object.keys(r.fails).length) console.log(`  fails: ${JSON.stringify(r.fails)}`);
    // Print stats
    if (task === 'intent.plan' && r.stats.actions) console.log(`  actions: ${JSON.stringify(r.stats.actions)} itemRate: ${((r.stats.itemCount||0)/(r.pass||1)).toFixed(2)}`);
    if (task === 'result.narrate' && r.stats.count) console.log(`  avgLen: ${Math.round((r.stats.len||0)/(r.stats.count||1))}`);
    if (task === 'intent.disambiguate' && r.stats.count) console.log(`  avgOptions: ${((r.stats.opt||0)/(r.stats.count||1)).toFixed(2)}`);
    if (task === 'entity.link' && r.stats.count) console.log(`  avgRefs: ${((r.stats.refs||0)/(r.stats.count||1)).toFixed(2)}`);
    if (task === 'safety.screen' && r.stats.reasons) console.log(`  flagRate: ${(((r.stats.flag||0)/(r.pass||1))*100).toFixed(1)}% reasons: ${JSON.stringify(r.stats.reasons)}`);
    if (task === 'chat' && r.stats.count) console.log(`  avgLen: ${Math.round((r.stats.len||0)/(r.stats.count||1))}`);
  }
}

function main() {
  const splits = fs.existsSync(BASE) && fs.statSync(BASE).isDirectory() ? fs.readdirSync(BASE) : [];
  if (splits.includes('train') || splits.includes('valid') || splits.includes('test')) {
    if (splits.includes('train')) benchSplit(path.join(BASE,'train'), 'train');
    if (splits.includes('valid')) benchSplit(path.join(BASE,'valid'), 'valid');
    if (splits.includes('test')) benchSplit(path.join(BASE,'test'), 'test');
  } else {
    benchSplit(BASE, 'flat');
  }
}

main();


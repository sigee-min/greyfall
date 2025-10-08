#!/usr/bin/env node
// SFT dataset validator (JSONL) aligned with runtime validators.
// Usage: node scripts/ft-validate.mjs [baseDir=docs/fine-tuning/data/v1]

import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || 'docs/fine-tuning/data/v1';

const ACTIONS = new Set([
  'sneak_move','melee_attack','ranged_attack','cast_spell','observe','hide','dash','defend','interact','talk',
  'heal','item.give','equip','unequip','no_action'
]);
const CHECKS = new Set(['stealth','perception','athletics','acrobatics','insight','intimidation','persuasion','survival','arcana']);
const HAZARDS = new Set(['thorns','slippery','darkness','trap','fire','poison_gas']);
const SAFETY_REASONS = new Set(['violence_detail','sexual_content','hate','self_harm','minors','doxxing','illicit','graphic_gore','other']);

const caps = {
  plan: { maxChecks: 2, maxHazards: 2, maxTargets: 2 },
  narrate: { maxSentences: 3, maxChars: 280 },
  names: { min: 2, max: 3, maxLen: 12 },
  bullets: { min: 2, max: 3, maxLen: 48 },
  disamb: { min: 2, max: 4, qMax: 60, optMax: 30 },
  entity: { max: 3, textMax: 24 },
  suggest: { min: 2, max: 3, maxLen: 28 },
  safety: { maxReasons: 3, suggestMax: 50 }
};

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
}

function* iterLines(file) {
  const data = fs.readFileSync(file, 'utf8');
  for (const line of data.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    yield t;
  }
}

function sentences(text) {
  return String(text || '').trim().split(/(?<=[.!?])\s+/u).filter(Boolean);
}

function okActor(id) { return typeof id === 'string' && /^p:/.test(id); }

function validate(task, sample) {
  const errs = [];
  const out = sample.output;
  switch (task) {
    case 'intent.plan': {
      if (!out || typeof out !== 'object') { errs.push('output not object'); break; }
      const a = String(out.action || '').toLowerCase();
      if (!ACTIONS.has(a)) errs.push('action invalid');
      const checks = Array.isArray(out.checks) ? out.checks : [];
      if (checks.length > caps.plan.maxChecks) errs.push('checks too many');
      if (!checks.every((c) => CHECKS.has(String(c).toLowerCase()))) errs.push('checks invalid');
      const hazards = Array.isArray(out.hazards) ? out.hazards : [];
      if (hazards.length > caps.plan.maxHazards) errs.push('hazards too many');
      if (!hazards.every((h) => HAZARDS.has(String(h).toLowerCase()))) errs.push('hazards invalid');
      const targets = Array.isArray(out.targets) ? out.targets : [];
      if (targets.length > caps.plan.maxTargets) errs.push('targets too many');
      if (!targets.every(okActor)) errs.push('targets invalid');
      if (out.item != null && typeof out.item !== 'string') errs.push('item invalid');
      const reason = out?.meta?.reason;
      if (reason != null && typeof reason !== 'string') errs.push('reason invalid');
      break;
    }
    case 'result.narrate': {
      const text = String(out || '');
      if (!text.trim()) errs.push('empty text');
      if (text.length > caps.narrate.maxChars) errs.push('too long');
      if (sentences(text).length > caps.narrate.maxSentences) errs.push('too many sentences');
      break;
    }
    case 'intent.disambiguate': {
      if (!out || typeof out !== 'object') { errs.push('output not object'); break; }
      const q = String(out.question || '');
      if (!q || q.length > caps.disamb.qMax) errs.push('question invalid');
      const opts = Array.isArray(out.options) ? out.options : [];
      if (opts.length < caps.disamb.min || opts.length > caps.disamb.max) errs.push('options size');
      if (!opts.every((s) => typeof s === 'string' && s.length <= caps.disamb.optMax)) errs.push('option invalid');
      break;
    }
    case 'entity.link': {
      const refs = Array.isArray(out?.refs) ? out.refs : [];
      if (refs.length > caps.entity.max) errs.push('too many refs');
      for (const r of refs) {
        if (!r || typeof r !== 'object') { errs.push('ref not obj'); continue; }
        const t = String(r.text || '');
        if (!t || t.length > caps.entity.textMax) errs.push('text invalid');
        if (!okActor(r.actor)) errs.push('actor invalid');
      }
      break;
    }
    case 'safety.screen': {
      if (typeof out?.flag !== 'boolean') errs.push('flag invalid');
      const reasons = Array.isArray(out?.reasons) ? out.reasons : [];
      if (reasons.length > caps.safety.maxReasons) errs.push('reasons too many');
      if (!reasons.every((r) => SAFETY_REASONS.has(String(r)))) errs.push('reason invalid');
      if (out?.suggest != null && (typeof out.suggest !== 'string' || out.suggest.length > caps.safety.suggestMax)) errs.push('suggest invalid');
      break;
    }
    case 'npc.reply': {
      const text = String(out || '');
      if (!text.trim()) errs.push('empty text');
      if (sentences(text).length > 2) errs.push('too many sentences');
      break;
    }
    case 'npc.name': {
      const names = Array.isArray(out?.names) ? out.names : [];
      if (names.length < caps.names.min || names.length > caps.names.max) errs.push('names size');
      if (!names.every((n) => typeof n === 'string' && n.length <= caps.names.maxLen)) errs.push('name invalid');
      break;
    }
    case 'turn.summarize':
    case 'turn.suggest': {
      const arr = Array.isArray(out?.bullets) ? out.bullets : [];
      const lim = task === 'turn.summarize' ? caps.bullets : caps.suggest;
      if (arr.length < lim.min || arr.length > lim.max) errs.push('bullets size');
      if (!arr.every((b) => typeof b === 'string' && b.length <= lim.maxLen)) errs.push('bullet invalid');
      break;
    }
    case 'scene.hazard.tag': {
      const hazards = Array.isArray(out?.hazards) ? out.hazards : [];
      if (hazards.length > 2) errs.push('hazards too many');
      if (!hazards.every((h) => HAZARDS.has(String(h).toLowerCase()))) errs.push('hazard invalid');
      break;
    }
    case 'rules.extract': {
      const keys = Array.isArray(out?.keys) ? out.keys : [];
      if (!keys.every((k) => typeof k === 'string' && k.trim())) errs.push('keys invalid');
      break;
    }
    case 'rules.narrate':
    case 'scene.brief':
    case 'scene.detail':
    case 'session.summarize': {
      const text = String(out || '');
      if (!text.trim()) errs.push('empty text');
      if (sentences(text).length > 3) errs.push('too many sentences');
      if (text.length > 360) errs.push('too long');
      break;
    }
    case 'chat': {
      const text = String(out || '');
      if (!text.trim()) errs.push('empty text');
      break;
    }
    default:
      errs.push('unknown task');
  }
  return errs;
}

function main() {
  const parts = ['train','valid','test'];
  const results = [];
  for (const part of parts) {
    const dir = path.join(BASE, part);
    for (const file of listFiles(dir)) {
      const task = path.basename(file, '.jsonl');
      let total = 0; let pass = 0; const errors = [];
      for (const line of iterLines(file)) {
        total += 1;
        let obj;
        try { obj = JSON.parse(line); } catch { errors.push({ line: total, error: 'invalid json' }); continue; }
        if (!obj?.meta || obj?.meta?.task !== task) { errors.push({ line: total, error: 'meta.task mismatch' }); continue; }
        const errs = validate(task, obj);
        if (errs.length === 0) pass += 1; else errors.push({ line: total, error: errs.join('|') });
      }
      results.push({ part, task, file, total, pass, fail: total - pass, errors: errors.slice(0, 10) });
    }
  }
  // Print report
  for (const r of results) {
    const pct = r.total ? ((r.pass / r.total) * 100).toFixed(1) : 'n/a';
    console.log(`[${r.part}] ${r.task} ${r.pass}/${r.total} (${pct}%) - ${r.file}`);
    if (r.errors.length) {
      for (const e of r.errors) console.log(`  ! line ${e.line}: ${e.error}`);
    }
  }
}

main();


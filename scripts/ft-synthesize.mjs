#!/usr/bin/env node
// Heuristic synthetic data generator for Greyfall tasks (no network).
// Reads JSONL lines with {meta, sections, user}, fills 'output' per task, validates, and writes JSONL.
// Usage: node scripts/ft-synthesize.mjs <inFile.jsonl> <outFile.jsonl>

import fs from 'fs';
import { sentences as _sentences, validate as _validate } from './ft-validate.mjs';

if (process.argv.length < 4) {
  console.error('Usage: node scripts/ft-synthesize.mjs <inFile.jsonl> <outFile.jsonl>');
  process.exit(1);
}
const IN = process.argv[2];
const OUT = process.argv[3];

function parseJsonl(file) {
  const data = fs.readFileSync(file, 'utf8');
  return data.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

function toJsonl(samples) {
  return samples.map((s) => JSON.stringify(s)).join('\n') + '\n';
}

function parseEligible(sections, key) {
  const arr = Array.isArray(sections?.targetsEligible) ? sections.targetsEligible : [];
  for (const line of arr) {
    const m = new RegExp(`${key}:\\[([^\]]+)\\]`).exec(line);
    if (m) return m[1].split(',').map((s) => s.trim());
  }
  return [];
}

function firstInventoryKey(sections, actor = 'p:host') {
  const arr = Array.isArray(sections?.inventory) ? sections.inventory : [];
  const line = arr.find((l) => l.startsWith(actor + ' '));
  if (!line) return null;
  const m = /items=\[([^\]]+)\]/.exec(line);
  if (!m) return null;
  const items = m[1].split(',').map((s) => s.trim());
  const first = items[0];
  const k = /([^\(\)]+)\(/.exec(first);
  return k ? k[1] : null;
}

function synth(sample) {
  const task = String(sample?.meta?.task || '').trim();
  const sec = sample?.sections || {};
  const user = sample?.user || {};
  const out = {};
  switch (task) {
    case 'intent.plan': {
      const heal = parseEligible(sec, 'heal');
      const give = parseEligible(sec, 'item.give');
      if (heal.length) {
        out.action = 'heal'; out.targets = [heal[0]]; out.meta = { reason: 'auto' };
      } else if (give.length) {
        out.action = 'item.give'; out.targets = [give[0]];
        const key = firstInventoryKey(sec) || 'potion_small';
        out.item = key; out.meta = { reason: 'auto' };
      } else {
        out.action = 'no_action';
      }
      break;
    }
    case 'result.narrate': {
      const eff = Array.isArray(sec.effects) ? sec.effects : [];
      if (eff.length) {
        out.output = `${eff[0]} — 처치가 반영됩니다.`;
      }
      break;
    }
    case 'intent.disambiguate': {
      const opts = [...parseEligible(sec, 'heal'), ...parseEligible(sec, 'item.give')].slice(0, 4);
      sample.output = { question: '대상을 선택해 주세요', options: opts.length >= 2 ? opts : ['p:host','p:bravo'] };
      return sample;
    }
    case 'entity.link': {
      const inst = String(user?.instruction || '').toLowerCase();
      const refs = [];
      if (inst.includes('medic') || inst.includes('메딕')) refs.push({ text: 'medic', actor: 'p:host' });
      if (inst.includes('bravo') || inst.includes('브라보')) refs.push({ text: 'bravo', actor: 'p:bravo' });
      sample.output = { refs: refs.slice(0, 3) };
      return sample;
    }
    case 'safety.screen': {
      const inst = String(user?.instruction || '');
      const bad = /(폭력|gore|잔혹|살해)/i.test(inst);
      sample.output = bad ? { flag: true, reasons: ['violence_detail'], suggest: '완곡한 표현으로 바꾸기' } : { flag: false, reasons: [] };
      return sample;
    }
    case 'npc.reply': {
      sample.output = '알겠다. 길을 서둘러라.'; return sample;
    }
    case 'npc.name': {
      sample.output = { names: ['이안','레아'] }; return sample;
    }
    case 'turn.summarize': {
      sample.output = { bullets: ['상태 점검','다음 목표 확인'] }; return sample;
    }
    case 'session.summarize': {
      sample.output = '팀은 합류 후 시장을 정찰했고 치료를 마쳤다. 다음은 아카이브 허가다.'; return sample;
    }
    case 'scene.brief': {
      sample.output = '네온과 비, 낮은 전류음이 흐른다.'; return sample;
    }
    case 'scene.detail': {
      sample.output = '현수막이 젖어 무겁게 흔들린다.'; return sample;
    }
    case 'rules.extract': {
      sample.output = { keys: ['heal.same_field'] }; return sample;
    }
    case 'rules.narrate': {
      sample.output = '같은 구역에서만 시도할 수 있다.'; return sample;
    }
    case 'turn.suggest': {
      sample.output = { bullets: ['허가 받기','보급 정리'] }; return sample;
    }
    case 'scene.hazard.tag': {
      sample.output = { hazards: ['slippery'] }; return sample;
    }
    case 'chat': {
      sample.output = '좋아요. 계속 진행합시다.'; return sample;
    }
    default:
      return sample;
  }
  sample.output = out;
  return sample;
}

function main() {
  const samples = parseJsonl(IN);
  const out = [];
  for (const s of samples) {
    const hasOutput = s.output != null && (typeof s.output === 'string' ? s.output.trim() : Object.keys(s.output || {}).length > 0);
    const filled = hasOutput ? s : synth(s);
    const errs = _validate(String(filled?.meta?.task || ''), filled);
    if (errs.length) {
      console.error(`[skip] ${filled?.meta?.id || '?'}: ${errs.join('|')}`);
      continue;
    }
    out.push(filled);
  }
  fs.writeFileSync(OUT, toJsonl(out));
  console.log(`[synthesize] wrote ${out.length} lines -> ${OUT}`);
}

main();


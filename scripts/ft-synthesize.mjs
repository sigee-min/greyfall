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

function parseRules(sections) {
  const lines = Array.isArray(sections?.rules) ? sections.rules : [];
  const rules = { sameFieldRequiredForHeal: false, sameFieldRequiredForGive: false };
  for (const l of lines) {
    if (/same_field_required_for_heal\s*=\s*true/i.test(l)) rules.sameFieldRequiredForHeal = true;
    if (/same_field_required_for_give\s*=\s*true/i.test(l)) rules.sameFieldRequiredForGive = true;
  }
  return rules;
}

function parsePositions(sections) {
  const map = new Map();
  const arr = Array.isArray(sections?.positions) ? sections.positions : [];
  for (const line of arr) {
    const id = (/(p:[^\s]+)/.exec(line) || [])[1];
    const mapId = (/map=([^\s]+)/.exec(line) || [])[1];
    const fieldId = (/field=([^\s]+)/.exec(line) || [])[1];
    if (id) map.set(id, { mapId, fieldId });
  }
  return map;
}

function sameField(posMap, a, b) {
  const pa = posMap.get(a); const pb = posMap.get(b);
  if (!pa || !pb) return false;
  return pa.mapId && pb.mapId && pa.fieldId && pb.fieldId && pa.mapId === pb.mapId && pa.fieldId === pb.fieldId;
}

function parseInventoryMap(sections) {
  const out = new Map();
  const arr = Array.isArray(sections?.inventory) ? sections.inventory : [];
  for (const line of arr) {
    const id = (/(p:[^\s]+)/.exec(line) || [])[1];
    const items = [];
    const m = /items=\[([^\]]+)\]/.exec(line);
    if (m) {
      for (const part of m[1].split(',')) {
        const mm = /([^\(\)]+)\((\d+)\)/.exec(part.trim());
        if (mm) items.push({ key: mm[1], count: Number(mm[2]) });
      }
    }
    if (id) out.set(id, items);
  }
  return out;
}

const SLOT_HINTS = [
  { slot: 'head', kws: ['모자','헬멧','후드','helmet','hood','cap','visor','고글','goggles','mask','마스크'] },
  { slot: 'offhand', kws: ['방패','실드','shield','buckler','램프','lamp','lantern','토치','torch','책','book','tome'] },
  { slot: 'mainhand', kws: ['검','sword','칼','knife','dagger','봉','지팡이','staff','창','spear','파이크','pike','망치','hammer','총','gun','rifle','pistol','smg'] },
  { slot: 'body', kws: ['코트','coat','갑옷','armor','재킷','jacket','베스트','vest','망토','cloak','슈트','suit'] },
  { slot: 'accessory', kws: ['반지','ring','목걸이','amulet','necklace','pendant','브레이스','bracelet','armband'] }
];

function guessSlotFromInstruction(inst) {
  const lc = String(inst || '').toLowerCase();
  for (const h of SLOT_HINTS) {
    if (h.kws.some((kw) => lc.includes(kw))) return h.slot;
  }
  return null;
}

function pickFirstInventoryKey(invMap, actorId, slotHint = null) {
  const list = invMap.get(actorId) || [];
  if (!slotHint) return list[0]?.key || null;
  // Heuristic mapping by keywords in key
  const idx = list.findIndex((i) => SLOT_HINTS.find((h) => h.slot === slotHint)?.kws.some((kw) => i.key.toLowerCase().includes(kw)));
  if (idx >= 0) return list[idx].key;
  return list[0]?.key || null;
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
      const rules = parseRules(sec);
      const posMap = parsePositions(sec);
      const invMap = parseInventoryMap(sec);
      const requester = (String(sec?.requester || '').match(/actor=(p:[^\s]+)/) || [])[1] || 'p:host';
      const inst = String(user?.instruction || '').toLowerCase();

      // Decide action based on instruction hints and eligibility
      const wantsEquip = /(장착|equip|wear)/i.test(inst);
      const wantsUnequip = /(해제|벗|unequip|remove)/i.test(inst);
      const wantsGive = /(줘|건네|give)/i.test(inst);
      const wantsHeal = /(치료|heal)/i.test(inst) || heal.length > 0;

      if (wantsHeal && heal.length) {
        const tgt = heal.find((t) => !rules.sameFieldRequiredForHeal || sameField(posMap, requester, t)) || heal[0];
        out.action = 'heal'; out.targets = [tgt]; out.meta = { reason: 'auto' };
      } else if (wantsGive && give.length) {
        const tgt = give.find((t) => !rules.sameFieldRequiredForGive || sameField(posMap, requester, t)) || give[0];
        out.action = 'item.give'; out.targets = [tgt];
        const slotHint = guessSlotFromInstruction(inst);
        const key = pickFirstInventoryKey(invMap, requester, slotHint) || firstInventoryKey(sec) || 'potion_small';
        out.item = key; out.meta = { reason: 'auto' };
      } else if (wantsEquip) {
        out.action = 'equip';
        const key = pickFirstInventoryKey(invMap, requester, guessSlotFromInstruction(inst)) || firstInventoryKey(sec) || 'hat_simple';
        out.item = key;
      } else if (wantsUnequip) {
        out.action = 'unequip';
        // no item specified; code side can choose first equipped (out of scope here)
      } else if (heal.length) {
        out.action = 'heal'; out.targets = [heal[0]];
      } else if (give.length) {
        out.action = 'item.give'; out.targets = [give[0]]; out.item = firstInventoryKey(sec) || 'potion_small';
      } else {
        out.action = 'no_action';
      }
      break;
    }
    case 'result.narrate': {
      const eff = Array.isArray(sec.effects) ? sec.effects : [];
      if (eff.length) {
        const e = eff[0];
        const ko = /[가-힣]/.test(String(user?.persona || 'ko'));
        out.output = ko ? `${e} — 효과가 반영되었습니다.` : `${e} — effect applied.`;
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
      const ko = /[가-힣]/.test(String(user?.persona || 'ko'));
      sample.output = ko ? '알겠다. 길을 서둘러라.' : 'Understood. Move quickly.'; return sample;
    }
    case 'npc.name': {
      sample.output = { names: ['이안','레아'] }; return sample;
    }
    case 'turn.summarize': {
      sample.output = { bullets: ['상태 점검','다음 목표 확인'] }; return sample;
    }
    case 'session.summarize': {
      const ko = /[가-힣]/.test(String(user?.persona || 'ko'));
      sample.output = ko ? '팀은 합류 후 시장을 정찰했고 치료를 마쳤다. 다음은 아카이브 허가다.' : 'The team regrouped, scouted the market, and treated minor wounds. Next: archive access.'; return sample;
    }
    case 'scene.brief': {
      const ko = /[가-힣]/.test(String(user?.persona || 'ko'));
      sample.output = ko ? '네온과 비, 낮은 전류음이 흐른다.' : 'Neon and rain, a faint hum of current.'; return sample;
    }
    case 'scene.detail': {
      const ko = /[가-힣]/.test(String(user?.persona || 'ko'));
      sample.output = ko ? '현수막이 젖어 무겁게 흔들린다.' : 'A soaked banner sways with weight.'; return sample;
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

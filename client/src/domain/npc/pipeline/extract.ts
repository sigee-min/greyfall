import type { NpcAction } from '../types';

// Very simple pattern-based extractor. Future: structured JSON from LLM
export function extractActionsFromText(npcId: string, text: string): NpcAction[] {
  const actions: NpcAction[] = [];
  const t = String(text || '').toLowerCase();
  if (/\b(끄덕|고개를 끄덕|nod)\b/.test(t)) actions.push({ type: 'emote', npcId, kind: 'nod' });
  if (/\b(미소|smile)\b/.test(t)) actions.push({ type: 'emote', npcId, kind: 'smile' });
  return actions;
}


import type { NpcMemory, MemoryEntry, Relationship } from '../../npc/types';

const memoryByNpc = new Map<string, NpcMemory>();

function emptyMemory(): NpcMemory {
  return { shortTerm: '', longTerm: [], relationships: {} };
}

export function getMemory(npcId: string): NpcMemory {
  return memoryByNpc.get(npcId) ?? emptyMemory();
}

export function setMemory(npcId: string, next: NpcMemory): void {
  memoryByNpc.set(npcId, { ...next, longTerm: [...next.longTerm] });
}

export type MemoryOp =
  | { op: 'add'; entry: MemoryEntry }
  | { op: 'upsertRel'; participantId: string; rel: Partial<Relationship> }
  | { op: 'short'; text: string };

export function applyMemoryOps(npcId: string, ops: MemoryOp[]): void {
  const cur = getMemory(npcId);
  const next: NpcMemory = { shortTerm: cur.shortTerm, longTerm: [...cur.longTerm], relationships: { ...cur.relationships } };
  for (const op of ops) {
    if (op.op === 'add') {
      next.longTerm.push(op.entry);
    } else if (op.op === 'upsertRel') {
      const prev = next.relationships[op.participantId] ?? { affinity: 0, trust: 0, tension: 0 };
      next.relationships[op.participantId] = { affinity: prev.affinity, trust: prev.trust, tension: prev.tension, ...op.rel };
    } else if (op.op === 'short') {
      next.shortTerm = op.text;
    }
  }
  setMemory(npcId, next);
}

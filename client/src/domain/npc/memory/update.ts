import type { MemoryOp } from './store';

export function proposeMemoryOps(params: { npcId: string; fromId: string; playerText: string; npcReply: string }): MemoryOp[] {
  const ops: MemoryOp[] = [];
  const trimmed = params.playerText.trim();
  if (trimmed) {
    ops.push({ op: 'add', entry: { id: `${Date.now()}:${Math.random().toString(16).slice(2)}`, kind: 'event', content: `Player:${params.fromId}→"${trimmed.slice(0, 120)}"`, salience: 0.4 } });
  }
  const reply = params.npcReply.trim();
  if (reply) {
    ops.push({ op: 'add', entry: { id: `${Date.now()}:${Math.random().toString(16).slice(2)}`, kind: 'event', content: `NPC:${params.npcId}→"${reply.slice(0, 120)}"`, salience: 0.6 } });
  }
  // short summary naive update
  ops.push({ op: 'short', text: `${params.fromId}:${trimmed.slice(0, 30)} / ${reply.slice(0, 30)}` });
  // relationship gentle nudge
  ops.push({ op: 'upsertRel', participantId: params.fromId, rel: { affinity: 0.1 } });
  return ops;
}


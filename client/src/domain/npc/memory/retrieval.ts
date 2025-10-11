import type { NpcMemory, MemoryEntry, Relationship } from '../types';

export function retrieveTopFacts(mem: NpcMemory, limit = 5): MemoryEntry[] {
  const sorted = [...mem.longTerm].sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0));
  return sorted.slice(0, Math.max(1, limit));
}

export function getRelationship(mem: NpcMemory, participantId: string): Relationship | undefined {
  return mem.relationships[participantId];
}


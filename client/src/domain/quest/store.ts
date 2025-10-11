import { create } from 'zustand';
import type { QuestCatalog, QuestProgress, QuestSnapshot } from './types';

type QuestStore = {
  catalog: QuestCatalog;
  snapshot: QuestSnapshot;
  setCatalog: (catalog: QuestCatalog) => void;
  setSnapshot: (next: QuestSnapshot) => void;
  // Actions (host-authoritative by convention)
  accept: (questId: string) => void;
  setActive: (questId: string | null) => void;
  updateObjective: (questId: string, objectiveId: string, delta: number) => void;
  completeStage: (questId: string) => void;
  completeQuest: (questId: string) => void;
  failQuest: (questId: string, _reason?: string) => void;
  abandon: (questId: string) => void;
  reset: () => void;
};

const emptySnapshot: QuestSnapshot = { activeQuestId: null, quests: [], updatedAt: 0 };

export const useQuestStore = create<QuestStore>((set, get) => ({
  catalog: {},
  snapshot: emptySnapshot,
  setCatalog: (catalog) => set({ catalog }),
  setSnapshot: (next) => set({ snapshot: { ...next, updatedAt: Date.now() } }),

  accept: (questId) => {
    const { snapshot, catalog } = get();
    if (!catalog[questId]) return;
    const exists = snapshot.quests.find((q) => q.id === questId);
    if (exists) return; // idempotent
    const stageIdx = -1;
    const qp: QuestProgress = {
      id: questId,
      status: 'active',
      stageIdx,
      objectives: [],
      updatedAt: Date.now()
    };
    set({ snapshot: { activeQuestId: questId, quests: [...snapshot.quests, qp], updatedAt: Date.now() } });
  },

  setActive: (questId) => {
    const { snapshot } = get();
    set({ snapshot: { ...snapshot, activeQuestId: questId, updatedAt: Date.now() } });
  },

  updateObjective: (questId, objectiveId, delta) => {
    const { snapshot, catalog } = get();
    const quest = catalog[questId];
    if (!quest) return;
    const idx = snapshot.quests.findIndex((q) => q.id === questId);
    if (idx === -1) return;
    const q = snapshot.quests[idx];
    const stage = quest.stages[Math.max(0, q.stageIdx)];
    const required = stage?.objectives.find((o) => o.id === objectiveId);
    if (!required) return;
    const count = Math.max(1, required.count ?? 1);
    const curr = q.objectives.find((o) => o.id === objectiveId) ?? { id: objectiveId, progress: 0, done: false };
    const nextProg = Math.max(0, Math.min(count, curr.progress + delta));
    const nextObj = { ...curr, progress: nextProg, done: nextProg >= count };
    const nextObjs = q.objectives.some((o) => o.id === objectiveId)
      ? q.objectives.map((o) => (o.id === objectiveId ? nextObj : o))
      : [...q.objectives, nextObj];
    const qs = [...snapshot.quests];
    qs[idx] = { ...q, objectives: nextObjs, updatedAt: Date.now() };
    set({ snapshot: { ...snapshot, quests: qs, updatedAt: Date.now() } });
  },

  completeStage: (questId) => {
    const { snapshot, catalog } = get();
    const quest = catalog[questId];
    if (!quest) return;
    const idx = snapshot.quests.findIndex((q) => q.id === questId);
    if (idx === -1) return;
    const q = snapshot.quests[idx];
    const nextStageIdx = Math.min((q.stageIdx + 1), quest.stages.length - 1);
    const resetObjs = [] as QuestProgress['objectives'];
    const qs = [...snapshot.quests];
    qs[idx] = { ...q, stageIdx: nextStageIdx, objectives: resetObjs, updatedAt: Date.now() };
    set({ snapshot: { ...snapshot, quests: qs, updatedAt: Date.now() } });
  },

  completeQuest: (questId) => {
    const { snapshot } = get();
    const idx = snapshot.quests.findIndex((q) => q.id === questId);
    if (idx === -1) return;
    const q = snapshot.quests[idx];
    const qs = [...snapshot.quests];
    qs[idx] = { ...q, status: 'completed', updatedAt: Date.now() };
    const activeQuestId = snapshot.activeQuestId === questId ? null : snapshot.activeQuestId;
    set({ snapshot: { ...snapshot, quests: qs, activeQuestId, updatedAt: Date.now() } });
  },

  failQuest: (questId) => {
    const { snapshot } = get();
    const idx = snapshot.quests.findIndex((q) => q.id === questId);
    if (idx === -1) return;
    const q = snapshot.quests[idx];
    const qs = [...snapshot.quests];
    qs[idx] = { ...q, status: 'failed', updatedAt: Date.now() };
    const activeQuestId = snapshot.activeQuestId === questId ? null : snapshot.activeQuestId;
    set({ snapshot: { ...snapshot, quests: qs, activeQuestId, updatedAt: Date.now() } });
  },

  abandon: (questId) => {
    const { snapshot } = get();
    const qs = snapshot.quests.filter((q) => q.id !== questId);
    const activeQuestId = snapshot.activeQuestId === questId ? null : snapshot.activeQuestId;
    set({ snapshot: { ...snapshot, quests: qs, activeQuestId, updatedAt: Date.now() } });
  },

  reset: () => set({ snapshot: emptySnapshot })
}));

export function selectQuestSnapshot(state: QuestStore) { return state.snapshot; }
export function selectQuestCatalog(state: QuestStore) { return state.catalog; }
export function selectActiveQuest(state: QuestStore) {
  const { snapshot, catalog } = state;
  const id = snapshot.activeQuestId;
  if (!id) return null;
  return { progress: snapshot.quests.find((q) => q.id === id) ?? null, quest: catalog[id] } as const;
}


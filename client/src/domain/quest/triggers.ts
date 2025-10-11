import { useQuestStore } from './store';

// Mapping helpers — link game events to quest objectives
type Mapping = Record<string, { questId: string; objectiveId: string; delta?: number }>;

const mappings = {
  visit: {} as Mapping,
  interact: {} as Mapping,
  talk: {} as Mapping,
  collect: {} as Mapping,
  deliver: {} as Mapping,
  defeat: {} as Mapping,
  useItem: {} as Mapping,
  craft: {} as Mapping
};

export function setQuestMappings(input: Partial<typeof mappings>) {
  Object.assign(mappings.visit, input.visit ?? {});
  Object.assign(mappings.interact, input.interact ?? {});
  Object.assign(mappings.talk, input.talk ?? {});
  Object.assign(mappings.collect, input.collect ?? {});
  Object.assign(mappings.deliver, input.deliver ?? {});
  Object.assign(mappings.defeat, input.defeat ?? {});
  Object.assign(mappings.useItem, input.useItem ?? {});
  Object.assign(mappings.craft, input.craft ?? {});
}

function applyMap(kind: keyof typeof mappings, key: string) {
  const entry = mappings[kind][key];
  if (!entry) return;
  try {
    const { questId, objectiveId, delta = 1 } = entry;
    useQuestStore.getState().updateObjective(questId, objectiveId, delta);
  } catch {}
}

// Event adapters (call from world/inventory/NPC systems)
export const triggers = {
  onVisit: (locationId: string) => applyMap('visit', locationId),
  onInteract: (objectId: string) => applyMap('interact', objectId),
  onTalk: (npcOrTopicId: string) => applyMap('talk', npcOrTopicId),
  onCollect: (itemId: string) => applyMap('collect', itemId),
  onDeliver: (itemIdToNpc: string) => applyMap('deliver', itemIdToNpc),
  onDefeat: (targetId: string) => applyMap('defeat', targetId),
  onUseItem: (itemId: string) => applyMap('useItem', itemId),
  onCraft: (recipeId: string) => applyMap('craft', recipeId)
};


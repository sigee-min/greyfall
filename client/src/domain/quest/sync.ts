import { defineSyncModel, registerSyncModel } from '../net-objects/sync-model';
import type { QuestCatalog, QuestSnapshot } from './types';
import { useQuestStore } from './store';
import type { ClientObject } from '../net-objects/types';
import type { ClientDescriptorDeps } from '../net-objects/registry';

export type QuestStateWire = {
  snapshot: QuestSnapshot;
  catalog?: QuestCatalog; // optional broadcast of catalog for late joiners
  version: number;
  since: number;
};

const initial: QuestStateWire = { snapshot: { activeQuestId: null, quests: [], updatedAt: 0 }, version: 1, since: Date.now() };

const questStateModel = defineSyncModel<QuestStateWire>({
  id: 'quest:state',
  initial: () => initial,
  requestOnStart: true,
  clientFactory: (_deps: ClientDescriptorDeps) => {
    return {
      id: 'quest:state',
      onReplace(_rev, value) {
        const raw = value as Record<string, unknown>;
        const snapshot = raw?.snapshot as QuestSnapshot | undefined;
        const catalog = raw?.catalog as QuestCatalog | undefined;
        try {
          if (catalog) useQuestStore.getState().setCatalog(catalog);
          if (snapshot) useQuestStore.getState().setSnapshot(snapshot);
        } catch {}
      }
    } as ClientObject;
  }
});

export const questStateSync = registerSyncModel(questStateModel);


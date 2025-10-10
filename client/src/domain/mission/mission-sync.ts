import { defineSyncModel, registerSyncModel } from '../net-objects/sync-model';
import type { MissionState } from '../equipment/policy';
import { useMissionStore } from './state';
import type { ClientObject } from '../net-objects/types';
import type { ClientDescriptorDeps } from '../net-objects/registry';

export type MissionStateData = {
  state: MissionState;
  reason?: string;
  since: number;
  version: number;
};

const initial: MissionStateData = { state: 'safe', since: Date.now(), version: 1 };

const missionStateModel = defineSyncModel<MissionStateData>({
  id: 'mission:state',
  initial: () => initial,
  requestOnStart: true,
  clientFactory: (_deps: ClientDescriptorDeps) => {
    return {
      id: 'mission:state',
      onReplace(_rev: number, value: unknown) {
        const raw = value as Record<string, unknown>;
        const next: MissionStateData = {
          state: (raw?.state as MissionState) ?? 'safe',
          reason: typeof raw?.reason === 'string' ? (raw.reason as string) : undefined,
          since: typeof raw?.since === 'number' ? (raw.since as number) : Date.now(),
          version: typeof raw?.version === 'number' ? (raw.version as number) : 1
        };
        try { useMissionStore.getState().set(next.state); } catch {}
      }
    } as ClientObject;
  }
});

export const missionStateSync = registerSyncModel(missionStateModel);

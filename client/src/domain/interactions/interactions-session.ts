import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';

export type InteractionStatus = 'pending' | 'confirmed' | 'cancelled';

export type Invite = {
  inviteId: string;
  fromId: string;
  toId: string;
  mapId: string;
  fieldId: string;
  verb: string;
  status: InteractionStatus;
  expiresAt?: number | null;
};

export type InteractionsState = {
  invites: Invite[];
};

const model = defineSyncModel<InteractionsState>({
  id: 'interact:sessions',
  initial: () => ({ invites: [] }),
  serialize: (d) => d,
  deserialize: (v) => (isInteractionsState(v) ? (v as InteractionsState) : null),
  requestOnStart: true,
  incrementalMax: 32
});

export const interactionsSync = registerSyncModel(model);

export function useInteractionsState<T = InteractionsState>(selector?: (s: InteractionsState) => T): T {
  return useSyncModel(interactionsSync, selector);
}

function isInteractionsState(v: unknown): v is InteractionsState {
  if (!v || typeof v !== 'object') return false;
  const o = v as { invites?: unknown };
  if (!Array.isArray(o.invites)) return false;
  return true;
}

import type { ClientObject } from './types';
import type { LobbyStore } from '../session/session-store';
import { PARTICIPANTS_OBJECT_ID, isParticipantsSnapshot } from './participants';

export class ClientParticipantsObject implements ClientObject {
  readonly id = PARTICIPANTS_OBJECT_ID;
  constructor(private lobbyStore: LobbyStore) {}

  onReplace(_rev: number, value: unknown) {
    if (isParticipantsSnapshot(value)) {
      this.lobbyStore.replaceFromWire(value.list);
      return;
    }
    // Legacy/compat shapes
    const v: any = value as any;
    if (Array.isArray(v?.participants)) {
      this.lobbyStore.replaceFromWire(v.participants);
      return;
    }
    if (Array.isArray(v?.list)) {
      this.lobbyStore.replaceFromWire(v.list);
    }
  }

  onPatch(_rev: number, _ops: unknown[]) {
    // Participants currently use replace snapshots for simplicity.
    // Patch support can be added later if we encode array diffs.
  }
}


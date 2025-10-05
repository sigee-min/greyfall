import { PARTICIPANTS_OBJECT_ID, isParticipantsSnapshot } from './participants';
export class ClientParticipantsObject {
    constructor(lobbyStore) {
        Object.defineProperty(this, "lobbyStore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: lobbyStore
        });
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: PARTICIPANTS_OBJECT_ID
        });
    }
    onReplace(_rev, value) {
        if (isParticipantsSnapshot(value)) {
            this.lobbyStore.replaceFromWire(value.list);
            return;
        }
        // Legacy/compat shapes
        const v = value;
        if (Array.isArray(v?.participants)) {
            this.lobbyStore.replaceFromWire(v.participants);
            return;
        }
        if (Array.isArray(v?.list)) {
            this.lobbyStore.replaceFromWire(v.list);
        }
    }
    onPatch(_rev, _ops) {
        // Participants currently use replace snapshots for simplicity.
        // Patch support can be added later if we encode array diffs.
    }
}

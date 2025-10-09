import { CHAT_OBJECT_ID } from './chat.js';
import { registerNetObject, HostAckFallback } from './registry.js';
import { HostListObject } from './base/list-object.js';
export class HostChatObject {
    constructor(deps) {
        this.id = CHAT_OBJECT_ID;
        // Use HostListObject to manage chat entries under path 'entries'
        this.list = new HostListObject(deps, this.id, { path: 'entries', max: 512, context: 'chat:init' });
    }
    append(entry, context) {
        this.list.append(entry, context ?? 'chat:append');
    }
    onRequest(sinceRev) {
        return this.list.onRequest(sinceRev);
    }
    getSnapshot() {
        return this.list.getSnapshot?.();
    }
    getLogsSince(sinceRev) {
        return this.list.getLogsSince?.(sinceRev);
    }
}
registerNetObject({
    id: CHAT_OBJECT_ID,
    host: {
        create: (deps) => new HostChatObject(deps),
        ack: {
            incrementalMax: 20,
            fallbackStrategy: HostAckFallback.Snapshot,
            broadcast: (object) => {
                object.onRequest(undefined);
            }
        },
        onPeerConnect: (object) => {
            object.onRequest(undefined);
        }
    },
    client: {
        requestOnStart: true,
        requestContext: 'request chatlog'
    }
});

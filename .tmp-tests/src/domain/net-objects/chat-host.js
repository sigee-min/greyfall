import { ChatHostStore, CHAT_OBJECT_ID } from './chat.js';
import { registerNetObject, HostAckFallback } from './registry.js';
export class HostChatObject {
    constructor(deps) {
        this.id = CHAT_OBJECT_ID;
        this.store = new ChatHostStore((kind, body, ctx) => deps.publish(kind, body, ctx));
    }
    append(entry, context) {
        this.store.append(entry, context);
    }
    onRequest(sinceRev) {
        return this.store.onRequest(sinceRev, 'object-request chatlog');
    }
    getSnapshot() {
        return this.store.snapshot();
    }
    getLogsSince(sinceRev) {
        return this.store.getLogsSince(sinceRev);
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

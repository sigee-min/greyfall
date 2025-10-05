import { ChatHostStore, CHAT_OBJECT_ID } from './chat.js';
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
}

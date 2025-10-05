export const CHAT_OBJECT_ID = 'chatlog';
export class ChatHostStore {
    constructor(publish, max = 200) {
        this.publish = publish;
        this.max = max;
        this.log = [];
        this.rev = 0;
    }
    append(entry, context = 'chat-append') {
        this.log.push(entry);
        while (this.log.length > this.max)
            this.log.shift();
        // increment revision and send incremental patch to append the entry
        const nextRev = ++this.rev;
        this.publish('object:patch', { id: CHAT_OBJECT_ID, rev: nextRev, ops: [{ op: 'insert', path: 'entries', value: entry }] }, context);
    }
    broadcastSnapshot(context = 'chat-snapshot') {
        if (this.log.length === 0)
            return false;
        return this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: this.rev, value: { entries: this.log } }, context);
    }
    onRequest(_sinceRev, context = 'chat-request') {
        return this.broadcastSnapshot(context);
    }
}

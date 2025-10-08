export const CHAT_OBJECT_ID = 'chatlog';
export class ChatHostStore {
    constructor(publish, max = 200) {
        this.publish = publish;
        this.max = max;
        this.log = [];
        this.rev = 0;
        this.opsLog = [];
    }
    append(entry, context = 'chat-append') {
        this.log.push(entry);
        while (this.log.length > this.max)
            this.log.shift();
        // If this is the very first append (no base snapshot yet), send a full snapshot instead of a patch
        if (this.rev === 0) {
            const nextRev = ++this.rev;
            const snapshot = { entries: this.log };
            // record as a 'set' op so incremental resend can reconstruct state
            const op = { op: 'set', value: snapshot };
            this.opsLog.push({ rev: nextRev, ops: [op] });
            this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: nextRev, value: snapshot }, context);
            return;
        }
        // Otherwise, send an incremental append patch
        const nextRev = ++this.rev;
        const ops = [{ op: 'insert', path: 'entries', value: entry }];
        this.opsLog.push({ rev: nextRev, ops });
        this.publish('object:patch', { id: CHAT_OBJECT_ID, rev: nextRev, ops }, context);
    }
    broadcastSnapshot(context = 'chat-snapshot') {
        if (this.log.length === 0)
            return false;
        return this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: this.rev, value: { entries: this.log } }, context);
    }
    onRequest(sinceRev, context = 'chat-request') {
        const sr = typeof sinceRev === 'number' ? sinceRev : undefined;
        if (sr != null && sr >= 0 && sr < this.rev) {
            const logs = this.getLogsSince(sr);
            if (logs.length > 0 && logs.length <= 50) {
                for (const entry of logs) {
                    this.publish('object:patch', { id: CHAT_OBJECT_ID, rev: entry.rev, ops: entry.ops }, context);
                }
                return true;
            }
        }
        // Fallback to full snapshot
        return this.broadcastSnapshot(context);
    }
    snapshot() {
        return { rev: this.rev, value: { entries: this.log } };
    }
    getLogsSince(sinceRev) {
        return this.opsLog.filter((e) => e.rev > sinceRev);
    }
}

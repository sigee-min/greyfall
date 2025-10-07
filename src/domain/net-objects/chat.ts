import type { LobbyMessageBodies } from '../../protocol';

export const CHAT_OBJECT_ID = 'chatlog';

export type ChatEntry = {
  id: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  authorRole: 'host' | 'guest';
  body: string;
  at: number;
};

export type Publish = <K extends keyof LobbyMessageBodies>(
  kind: K,
  body: LobbyMessageBodies[K],
  context?: string
) => boolean;

export class ChatHostStore {
  private log: ChatEntry[] = [];
  private rev = 0;
  private opsLog: { rev: number; ops: any[] }[] = [];
  constructor(private publish: Publish, private max = 200) {}

  append(entry: ChatEntry, context = 'chat-append') {
    this.log.push(entry);
    while (this.log.length > this.max) this.log.shift();
    // If this is the very first append (no base snapshot yet), send a full snapshot instead of a patch
    if (this.rev === 0) {
      const nextRev = ++this.rev;
      const snapshot = { entries: this.log };
      // record as a 'set' op so incremental resend can reconstruct state
      this.opsLog.push({ rev: nextRev, ops: [{ op: 'set', value: snapshot }] as any[] });
      this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: nextRev, value: snapshot } as any, context);
      return;
    }
    // Otherwise, send an incremental append patch
    const nextRev = ++this.rev;
    const ops = [{ op: 'insert', path: 'entries', value: entry }] as any[];
    this.opsLog.push({ rev: nextRev, ops });
    this.publish('object:patch', { id: CHAT_OBJECT_ID, rev: nextRev, ops }, context);
  }

  broadcastSnapshot(context = 'chat-snapshot') {
    if (this.log.length === 0) return false;
    return this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: this.rev, value: { entries: this.log } } as any, context);
  }

  onRequest(sinceRev?: number, context = 'chat-request') {
    const sr = typeof sinceRev === 'number' ? sinceRev : undefined;
    if (sr != null && sr >= 0 && sr < this.rev) {
      const logs = this.getLogsSince(sr);
      if (logs.length > 0 && logs.length <= 50) {
        for (const entry of logs) {
          this.publish('object:patch', { id: CHAT_OBJECT_ID, rev: entry.rev, ops: entry.ops } as any, context);
        }
        return true;
      }
    }
    // Fallback to full snapshot
    return this.broadcastSnapshot(context);
  }

  snapshot() {
    return { rev: this.rev, value: { entries: this.log } } as const;
  }

  getLogsSince(sinceRev: number) {
    return this.opsLog.filter((e) => e.rev > sinceRev);
  }
}

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
  constructor(private publish: Publish, private max = 200) {}

  append(entry: ChatEntry, context = 'chat-append') {
    this.log.push(entry);
    while (this.log.length > this.max) this.log.shift();
    this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: Date.now(), value: { entries: this.log } } as any, context);
  }

  broadcastSnapshot(context = 'chat-snapshot') {
    if (this.log.length === 0) return false;
    return this.publish('object:replace', { id: CHAT_OBJECT_ID, rev: Date.now(), value: { entries: this.log } } as any, context);
  }

  onRequest(_sinceRev?: number, context = 'chat-request') {
    return this.broadcastSnapshot(context);
  }
}


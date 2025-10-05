import type { HostObject, CommonDeps } from './types';
import { ChatHostStore, type ChatEntry, CHAT_OBJECT_ID } from './chat';

export class HostChatObject implements HostObject {
  readonly id = CHAT_OBJECT_ID;
  private readonly store: ChatHostStore;

  constructor(deps: CommonDeps) {
    this.store = new ChatHostStore((kind, body, ctx) => deps.publish(kind as any, body as any, ctx));
  }

  append(entry: ChatEntry, context?: string) {
    this.store.append(entry, context);
  }

  onRequest(sinceRev?: number) {
    return this.store.onRequest(sinceRev, 'object-request chatlog');
  }
}


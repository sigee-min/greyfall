import type { SessionRole } from '../session/types';

export type LobbyChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  authorRole: SessionRole;
  body: string;
  at: number;
};

export type LobbyChatLogEntry = LobbyChatMessage & { isSelf: boolean };

// Backwards-compatible aliases for consumers still using session-prefixed names
export type SessionChatMessage = LobbyChatMessage;
export type SessionChatLogEntry = LobbyChatLogEntry;

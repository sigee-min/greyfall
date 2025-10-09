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
// Note: ChatHostStore has been replaced by HostListObject-based HostChatObject.
// This module now solely defines the chat object ID and entry type.

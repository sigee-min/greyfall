import type { SessionParticipant } from '../session/types';
import type { SessionMeta } from '../session/use-session';
import type { LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { useChatNetSync, type RegisterLobbyHandler, type PublishLobbyMessage } from './use-chat-net-sync';

type UseLobbyChatOptions = {
  registerLobbyHandler: RegisterLobbyHandler;
  publishLobbyMessage: PublishLobbyMessage;
  participants: SessionParticipant[];
  localParticipantId: string | null;
  sessionMeta: SessionMeta;
};

export function useLobbyChat(opts: UseLobbyChatOptions) {
  return useChatNetSync(opts);
}

export type { RegisterLobbyHandler, PublishLobbyMessage } from './use-chat-net-sync';

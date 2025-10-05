import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { SessionParticipant } from '../session/types';
import type { SessionMeta } from '../session/use-session';
import type { SessionChatLogEntry, SessionChatMessage } from './types';
import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { useGameBus } from '../../bus/game-bus';

export type RegisterLobbyHandler = <K extends LobbyMessageKind>(
  kind: K,
  handler: (message: Extract<LobbyMessage, { kind: K }>) => void
) => () => void;

export type PublishLobbyMessage = <K extends LobbyMessageKind>(
  kind: K,
  body: LobbyMessageBodies[K],
  context?: string
) => boolean;

type UseLobbyChatOptions = {
  registerLobbyHandler: RegisterLobbyHandler;
  publishLobbyMessage: PublishLobbyMessage;
  participants: SessionParticipant[];
  localParticipantId: string | null;
  sessionMeta: SessionMeta;
};

export function useLobbyChat({
  registerLobbyHandler,
  publishLobbyMessage,
  participants,
  localParticipantId,
  sessionMeta
}: UseLobbyChatOptions) {
  const [chatMessages, setChatMessages] = useState<SessionChatLogEntry[]>([]);
  const [channelReady, setChannelReady] = useState<boolean>(() => {
    const channel = sessionMeta?.session.channel;
    return channel?.readyState === 'open';
  });
  const participantsRef = useRef<SessionParticipant[]>(participants);
  const localIdRef = useRef<string | null>(localParticipantId);
  type SessionModeValue = 'host' | 'guest' | null;
  const sessionMode: SessionModeValue = sessionMeta ? sessionMeta.mode : null;
  const sessionKey = sessionMeta ? sessionMeta.session : null;
  const modeRef = useRef<SessionModeValue>(sessionMode);
  const gameBus = useGameBus();

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    localIdRef.current = localParticipantId;
  }, [localParticipantId]);

  useEffect(() => {
    modeRef.current = sessionMeta ? sessionMeta.mode : null;
  }, [sessionMeta]);

  useEffect(() => {
    const channel = sessionMeta?.session.channel;
    if (!channel) {
      setChannelReady(false);
      return undefined;
    }
    const handleStateChange = () => {
      setChannelReady(channel.readyState === 'open');
    };
    handleStateChange();
    channel.addEventListener('open', handleStateChange);
    channel.addEventListener('close', handleStateChange);
    channel.addEventListener('error', handleStateChange);
    return () => {
      channel.removeEventListener('open', handleStateChange);
      channel.removeEventListener('close', handleStateChange);
      channel.removeEventListener('error', handleStateChange);
    };
  }, [sessionMeta]);

  useEffect(() => {
    setChatMessages([]);
  }, [sessionKey]);

  useEffect(() => {
    const unsubscribe = registerLobbyHandler('chat', (message) => {
      const entry = message.body.entry;
      const isSelf = localIdRef.current ? entry.authorId === localIdRef.current : false;
      setChatMessages((previous) => [
        ...previous,
        {
          ...entry,
          isSelf
        }
      ]);
      gameBus.publish('lobby:chat', { entry, self: isSelf });
    });

    return unsubscribe;
  }, [gameBus, registerLobbyHandler]);

  const sendChatMessage = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return false;

      const authorId = localIdRef.current;
      if (!authorId) {
        console.warn('[chat] send skipped – missing local participant');
        return false;
      }

      if (!channelReady) {
        console.info('[chat] send skipped – channel not open');
        return false;
      }

      const author = participantsRef.current.find((participant) => participant.id === authorId);
      const authorRole: SessionParticipant['role'] = author?.role ?? modeRef.current ?? 'guest';

      const entry: SessionChatMessage = {
        id: nanoid(12),
        authorId,
        authorName: author?.name ?? 'Unknown',
        authorTag: author?.tag ?? '#????',
        authorRole,
        body: trimmed,
        at: Date.now()
      };

      const displayEntry: SessionChatLogEntry = {
        ...entry,
        isSelf: true
      };

      setChatMessages((previous) => [...previous, displayEntry]);

      const delivered = publishLobbyMessage('chat', { entry }, 'chat-send');
      if (!delivered) {
        console.warn('[chat] message may not reach peer', { reason: 'channel not open' });
      }

      gameBus.publish('lobby:chat', { entry, self: true });

      return true;
    },
    [channelReady, gameBus, publishLobbyMessage]
  );

  const chatLog = useMemo(() => chatMessages, [chatMessages]);

  return {
    chatMessages: chatLog,
    sendChatMessage,
    canSendChat: channelReady && Boolean(localIdRef.current)
  };
}

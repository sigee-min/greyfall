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

  // Host-authoritative chat object: replace handler
  useEffect(() => {
    const unsubscribe = registerLobbyHandler('object:replace', (message) => {
      if (message.body.id !== 'chatlog') return;
      const value: any = message.body.value;
      const entries = Array.isArray(value?.entries) ? (value.entries as SessionChatLogEntry[] | any[]) : Array.isArray(value?.list) ? (value.list as SessionChatLogEntry[] | any[]) : null;
      if (!entries) return;
      // Map to local shape and mark self messages
      const mapped = entries.map((e: any) => ({
        id: String(e.id),
        authorId: String(e.authorId),
        authorName: String(e.authorName),
        authorTag: String(e.authorTag),
        authorRole: e.authorRole,
        body: String(e.body),
        at: Number(e.at),
        isSelf: localIdRef.current ? String(e.authorId) === localIdRef.current : false
      })) as SessionChatLogEntry[];
      setChatMessages(mapped);
    });
    return unsubscribe;
  }, [registerLobbyHandler]);

  const sendChatMessage = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return false;

      const authorId = localIdRef.current;
      if (!authorId) {
        console.warn('[chat] send skipped – missing local participant');
        return false;
      }

      // 채널이 열리지 않았어도 로컬 로그에는 추가하고, 전송은 큐에 쌓입니다.

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

      // Host-authoritative path: request Host to append; Host rebroadcasts chatlog snapshot/patch
      const delivered = publishLobbyMessage('chat:append:request', { body: trimmed, authorId }, 'chat-send');
      if (!delivered) {
        console.info('[chat] queued until channel open');
      }

      return true;
    },
    [publishLobbyMessage]
  );

  const chatLog = useMemo(() => chatMessages, [chatMessages]);

  return {
    chatMessages: chatLog,
    sendChatMessage,
    // 입력은 로컬 참가자 존재 여부만 확인해 허용하고,
    // 전송은 내부적으로 큐잉되어 채널 오픈 시 플러시됩니다.
    canSendChat: Boolean(localIdRef.current),
    channelOpen: channelReady
  } as const;
}

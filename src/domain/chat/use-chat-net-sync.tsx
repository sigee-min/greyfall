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

type UseChatNetSyncOptions = {
  registerLobbyHandler: RegisterLobbyHandler;
  publishLobbyMessage: PublishLobbyMessage;
  participants: SessionParticipant[];
  localParticipantId: string | null;
  sessionMeta: SessionMeta;
};

export function useChatNetSync({
  registerLobbyHandler,
  publishLobbyMessage,
  participants,
  localParticipantId,
  sessionMeta
}: UseChatNetSyncOptions) {
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

  useEffect(() => {
    const unsubscribe = registerLobbyHandler('object:replace', (message) => {
      if (message.body.id !== 'chatlog') return;
      const value: any = message.body.value;
      const entries = Array.isArray(value?.entries) ? (value.entries as SessionChatLogEntry[] | any[]) : Array.isArray(value?.list) ? (value.list as SessionChatLogEntry[] | any[]) : null;
      if (!entries) return;
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

  useEffect(() => {
    const unsubscribe = registerLobbyHandler('object:patch', (message) => {
      if (message.body.id !== 'chatlog') return;
      const ops = (message.body as any).ops as any[];
      if (!Array.isArray(ops) || ops.length === 0) return;
      setChatMessages((prev) => {
        let next = prev.slice();
        for (const op of ops) {
          if (op?.op === 'insert') {
            const val = op.value;
            const list = Array.isArray(val) ? val : [val];
            for (const e of list) {
              const mapped: SessionChatLogEntry = {
                id: String(e.id),
                authorId: String(e.authorId),
                authorName: String(e.authorName),
                authorTag: String(e.authorTag),
                authorRole: e.authorRole,
                body: String(e.body),
                at: Number(e.at),
                isSelf: localIdRef.current ? String(e.authorId) === localIdRef.current : false
              };
              next.push(mapped);
            }
          } else if (op?.op === 'set') {
            const value: any = op.value;
            const entries = Array.isArray(value?.entries)
              ? (value.entries as any[])
              : Array.isArray(value?.list)
                ? (value.list as any[])
                : null;
            if (entries) {
              next = entries.map((e: any) => ({
                id: String(e.id),
                authorId: String(e.authorId),
                authorName: String(e.authorName),
                authorTag: String(e.authorTag),
                authorRole: e.authorRole,
                body: String(e.body),
                at: Number(e.at),
                isSelf: localIdRef.current ? String(e.authorId) === localIdRef.current : false
              }));
            }
          }
        }
        return next;
      });
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
    canSendChat: Boolean(localIdRef.current),
    channelOpen: channelReady
  } as const;
}


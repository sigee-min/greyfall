import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { SessionParticipant } from '../session/types';
import type { SessionMeta } from '../session/use-session';
import type { SessionChatLogEntry } from './types';
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
      const entries = extractSnapshotEntries(message.body.value, localIdRef.current);
      if (entries === undefined) return;
      setChatMessages(entries);
    });
    return unsubscribe;
  }, [registerLobbyHandler]);

  useEffect(() => {
    const unsubscribe = registerLobbyHandler('object:patch', (message) => {
      if (message.body.id !== 'chatlog') return;
      const ops = message.body.ops;
      if (ops.length === 0) return;
      setChatMessages((prev) => {
        let next = prev;
        let changed = false;
        for (const op of ops) {
          if (op.op === 'insert') {
            const inserted = normaliseEntryList(op.value, localIdRef.current);
            if (inserted && inserted.length > 0) {
              next = [...next, ...inserted];
              changed = true;
            }
          } else if (op.op === 'set') {
            const entries = extractSnapshotEntries(op.value, localIdRef.current);
            if (entries !== undefined) {
              next = entries;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
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
      const delivered = publishLobbyMessage('chat:append:request', { body: trimmed, authorId }, 'chat-send');
      if (delivered) {
        // Do not locally echo; rely on host broadcast (object:patch/replace)
        // to avoid duplicates on guests.
        return true;
      }
      console.info('[chat] send skipped – channel not open');
      return false;
    },
    [publishLobbyMessage]
  );

  const chatLog = useMemo(() => chatMessages, [chatMessages]);
  const probeChannel = useCallback(() => {
    const channel = sessionMeta?.session.channel;
    if (!channel) {
      setChannelReady(false);
      return false;
    }
    const state = channel.readyState;
    setChannelReady(state === 'open');
    return state === 'open';
  }, [sessionMeta]);

  return {
    chatMessages: chatLog,
    sendChatMessage,
    canSendChat: Boolean(localIdRef.current),
    channelOpen: channelReady,
    probeChannel
  } as const;
}

type RawChatEntry = {
  id?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  authorTag?: unknown;
  authorRole?: unknown;
  body?: unknown;
  at?: unknown;
};

function extractSnapshotEntries(value: unknown, selfId: string | null): SessionChatLogEntry[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return normaliseEntryList(value, selfId);
  if (typeof value === 'object') {
    const record = value as { entries?: unknown; list?: unknown };
    if (record.entries !== undefined) return normaliseEntryList(record.entries, selfId);
    if (record.list !== undefined) return normaliseEntryList(record.list, selfId);
  }
  return undefined;
}

function normaliseEntryList(value: unknown, selfId: string | null): SessionChatLogEntry[] | undefined {
  if (Array.isArray(value)) {
    const mapped = value
      .map((entry) => toChatLogEntry(entry, selfId))
      .filter((entry): entry is SessionChatLogEntry => Boolean(entry));
    return mapped;
  }
  const single = toChatLogEntry(value, selfId);
  return single ? [single] : undefined;
}

function toChatLogEntry(raw: unknown, selfId: string | null): SessionChatLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as RawChatEntry;
  const authorId = coerceString(entry.authorId);
  if (!authorId) return null;
  const id = coerceId(entry.id);
  const authorName = coerceString(entry.authorName, 'Unknown');
  const authorTag = coerceString(entry.authorTag, '#????');
  const authorRole = coerceRole(entry.authorRole);
  const body = coerceString(entry.body);
  const at = coerceTimestamp(entry.at);
  return {
    id,
    authorId,
    authorName,
    authorTag,
    authorRole,
    body,
    at,
    isSelf: selfId ? authorId === selfId : false
  };
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return fallback;
}

function coerceId(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'bigint') {
    const str = String(value);
    return str.trim() ? str : nanoid(12);
  }
  return nanoid(12);
}

function coerceRole(value: unknown): SessionParticipant['role'] {
  return value === 'host' || value === 'guest' ? value : 'guest';
}

function coerceTimestamp(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : Date.now();
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { SessionParticipant } from './types';
import type { LobbyParticipant as LobbyWireParticipant } from '../../protocol';

export type SessionWireParticipant = LobbyWireParticipant;

export type LobbyStore = {
  participants: SessionParticipant[];
  participantsRef: MutableRefObject<SessionParticipant[]>;
  localParticipantId: string | null;
  localParticipantIdRef: MutableRefObject<string | null>;
  setLocalParticipantId: (id: string | null) => void;
  replaceFromWire: (list: SessionWireParticipant[]) => void;
  upsertFromWire: (participant: SessionWireParticipant) => void;
  remove: (participantId: string) => void;
  hostSnapshot: () => SessionWireParticipant[];
  toWire: (participant: SessionParticipant) => SessionWireParticipant;
  snapshotWire: () => SessionWireParticipant[];
};

export function useLobbyStore(): LobbyStore {
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const participantsRef = useRef<SessionParticipant[]>(participants);

  const [localParticipantId, setLocalParticipantIdState] = useState<string | null>(null);
  const localParticipantIdRef = useRef<string | null>(null);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const decorate = useCallback(
    (list: SessionWireParticipant[]): SessionParticipant[] => {
      const localId = localParticipantIdRef.current;
      return list.map((participant) => ({
        ...participant,
        isSelf: participant.id === localId
      }));
    },
    []
  );

  const toWire = useCallback((participant: SessionParticipant): SessionWireParticipant => ({
    id: participant.id,
    name: participant.name,
    tag: participant.tag,
    ready: participant.ready,
    role: participant.role,
    avatarUrl: participant.avatarUrl || undefined
  }), []);

  const snapshotWire = useCallback(() => participantsRef.current.map(toWire), [toWire]);

  const replaceFromWire = useCallback(
    (list: SessionWireParticipant[]) => {
      const decorated = decorate(list);
      participantsRef.current = decorated;
      setParticipants(decorated);
    },
    [decorate]
  );

  const upsertFromWire = useCallback(
    (participant: SessionWireParticipant) => {
      const base = participantsRef.current.filter((entry) => entry.id !== participant.id);
      replaceFromWire([...base.map(toWire), participant]);
    },
    [replaceFromWire, toWire]
  );

  const remove = useCallback(
    (participantId: string) => {
      const base = participantsRef.current.filter((entry) => entry.id !== participantId);
      replaceFromWire(base.map(toWire));
    },
    [replaceFromWire, toWire]
  );

  const hostSnapshot = useCallback(() => {
    return participantsRef.current.filter((participant) => participant.role === 'host').map(toWire);
  }, [toWire]);

  const setLocalParticipantId = useCallback(
    (id: string | null) => {
      localParticipantIdRef.current = id;
      setLocalParticipantIdState(id);
      replaceFromWire(participantsRef.current.map(toWire));
    },
    [replaceFromWire, toWire]
  );

  return useMemo(
    () => ({
      participants,
      participantsRef,
      localParticipantId,
      localParticipantIdRef,
      setLocalParticipantId,
      replaceFromWire,
      upsertFromWire,
      remove,
      hostSnapshot,
      toWire,
      snapshotWire
    }),
    [
      hostSnapshot,
      localParticipantId,
      remove,
      participants,
      replaceFromWire,
      setLocalParticipantId,
      snapshotWire,
      toWire,
      upsertFromWire
    ]
  );
}

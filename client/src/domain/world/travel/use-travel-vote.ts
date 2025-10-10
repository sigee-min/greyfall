import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../../chat/use-lobby-chat';
import { WORLD_STATIC } from '../../world/data';
import { worldPositionsClient } from '../../net-objects/world-positions-client';

type Status = 'idle' | 'proposed' | 'approved' | 'rejected' | 'cancelled';

export type TravelVoteState = {
  status: Status;
  targetMapId: string | null;
  inviteId: string | null;
  proposerId?: string;
  yes: number;
  no: number;
  total: number;
  quorum: 'majority' | 'all';
  deadlineAt?: number;
};

export type TravelVoteComputed = {
  isActive: boolean;
  isHost: boolean;
  progressPct: number; // 0..1
  secondsLeft: number;
  canPropose: boolean;
  canVote: boolean;
  canCancel: boolean;
};

export type TravelVoteActions = {
  propose: (dirOrMap: { direction?: 'next' | 'prev'; toMapId?: string; quorum?: 'majority' | 'all' }) => boolean;
  vote: (approve: boolean) => boolean;
  cancel: () => boolean;
  expand: (open: boolean) => void;
};

export function useTravelVote(args: {
  registerLobbyHandler: RegisterLobbyHandler;
  publishLobbyMessage: PublishLobbyMessage;
  localParticipantId: string | null;
  sessionMode?: 'host' | 'guest' | null;
}) {
  const { registerLobbyHandler, publishLobbyMessage, localParticipantId, sessionMode } = args;
  const [state, setState] = useState<TravelVoteState>({ status: 'idle', targetMapId: null, inviteId: null, yes: 0, no: 0, total: 0, quorum: 'majority' });
  const [expanded, setExpanded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const isHost = (sessionMode === 'host');

  useEffect(() => {
    const unsubUpdate = registerLobbyHandler('map:travel:update', (msg) => {
      const b = msg.body;
      setState({
        status: b.status,
        targetMapId: b.targetMapId,
        inviteId: b.inviteId ?? null,
        yes: b.yes,
        no: b.no,
        total: b.total,
        quorum: b.quorum,
      });
      if (b.status === 'proposed') setExpanded(true);
    });
    const unsubCancel = registerLobbyHandler('map:travel:cancel', (_msg) => {
      setState((s) => ({ ...s, status: 'cancelled' }));
      setExpanded(false);
    });
    return () => { unsubUpdate(); unsubCancel(); };
  }, [registerLobbyHandler]);

  // Countdown
  useEffect(() => {
    const id = window.setInterval(() => {
      const dl = state.deadlineAt;
      if (typeof dl === 'number') {
        setSecondsLeft(Math.max(0, Math.ceil((dl - Date.now()) / 1000)));
      } else {
        setSecondsLeft(0);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.deadlineAt]);

  const currentMap = useMemo(() => {
    const pos = localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null;
    const mid = pos?.mapId ?? WORLD_STATIC.head;
    return WORLD_STATIC.maps.find((m) => m.id === mid) ?? WORLD_STATIC.maps[0];
  }, [localParticipantId]);

  const atEntryForAll = useMemo(() => {
    const map = currentMap;
    const entryId = map.entryFieldId;
    const all = worldPositionsClient.getAll().filter((p) => p.mapId === map.id);
    if (all.length === 0) return false;
    return all.every((p) => p.fieldId === entryId);
  }, [currentMap]);

  const isActive = state.status === 'proposed';
  const progressPct = state.total > 0 ? Math.min(1, (state.yes + state.no) / state.total) : 0;
  const canPropose = !isActive && Boolean(localParticipantId) && atEntryForAll;
  const canCancel = isHost && isActive;
  const canVote = isActive && Boolean(localParticipantId);

  const resolveToMapId = (params: { direction?: 'next' | 'prev'; toMapId?: string }): string | null => {
    if (params.toMapId) return params.toMapId;
    const dir = params.direction;
    if (!dir) return null;
    if (dir === 'next') return currentMap.next ?? null;
    if (dir === 'prev') return currentMap.prev ?? null;
    return null;
  };

  const propose: TravelVoteActions['propose'] = useCallback((params) => {
    if (!canPropose || !localParticipantId) return false;
    const toMapId = resolveToMapId(params);
    if (!toMapId) return false;
    const ok = publishLobbyMessage('map:travel:propose', {
      requesterId: localParticipantId,
      direction: params.direction,
      toMapId: params.toMapId,
      quorum: params.quorum
    }, 'ui:travel:propose');
    if (ok) setExpanded(true);
    return ok;
  }, [canPropose, localParticipantId, publishLobbyMessage]);

  const vote: TravelVoteActions['vote'] = useCallback((approve) => {
    if (!canVote || !localParticipantId) return false;
    const inviteId = state.inviteId ?? null;
    if (!inviteId) return false;
    return publishLobbyMessage('map:travel:vote', {
      inviteId,
      voterId: localParticipantId,
      approve
    }, 'ui:travel:vote');
  }, [canVote, localParticipantId, publishLobbyMessage, state.inviteId]);

  const cancel: TravelVoteActions['cancel'] = useCallback(() => {
    if (!canCancel || !localParticipantId) return false;
    const inviteId = state.inviteId ?? null;
    if (!inviteId) return false;
    return publishLobbyMessage('map:travel:cancel', { inviteId, byId: localParticipantId }, 'ui:travel:cancel');
  }, [canCancel, localParticipantId, publishLobbyMessage, state.inviteId]);

  const expand: TravelVoteActions['expand'] = useCallback((open) => setExpanded(open), []);

  const computed: TravelVoteComputed = { isActive, isHost, progressPct, secondsLeft, canPropose, canVote, canCancel };
  const actions: TravelVoteActions = { propose, vote, cancel, expand };

  return { state, computed, actions, expanded } as const;
}

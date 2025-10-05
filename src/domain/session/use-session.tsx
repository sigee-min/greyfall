import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { SessionMode, SessionParticipant } from './types';
import { generateUserTag } from '../../lib/utils';
import type { GuestLobbySession, HostLobbySession, RTCBridgeEvents } from '../../rtc/webrtc';
import {
  createLobbyMessage,
  LobbyMessage,
  LobbyMessageBodies,
  LobbyMessageKind,
  parseLobbyMessage
} from '../../protocol';
import { useLobbyStore, type SessionWireParticipant } from './session-store';
import { useLobbyBus } from '../../bus/lobby-bus';
import { useGlobalBus } from '../../bus/global-bus';
import { useGameBus } from '../../bus/game-bus';
import {
  isLikelySignalCode,
  requestSignalSessionId,
  SIGNAL_SERVER_AVAILABLE,
  useSignalBridge
} from './signal-bridge';

export type SessionMeta =
  | ({ mode: 'host'; session: HostLobbySession; code: string; signalSessionId?: string | null } & Record<string, unknown>)
  | ({
      mode: 'guest';
      session: GuestLobbySession;
      code: string;
      answerCode: string;
      signalSessionId?: string | null;
    } & Record<string, unknown>)
  | null;

export type UseSessionDeps = {
  startHostSession: (
    events: RTCBridgeEvents,
    onIceCandidate?: (candidate: RTCIceCandidateInit) => void
  ) => Promise<HostLobbySession>;
  joinHostSession: (
    code: string,
    events: RTCBridgeEvents,
    onAnswer?: (answerCode: string) => void,
    onIceCandidate?: (candidate: RTCIceCandidateInit) => void
  ) => Promise<GuestLobbySession>;
};

export type UseSessionResult = {
  participants: SessionParticipant[];
  localParticipantId: string | null;
  sessionMeta: SessionMeta;
  createGame: (name: string) => Promise<void>;
  joinGame: (name: string, code: string) => Promise<void>;
  toggleReady: (participantId: string) => void;
  leaveSession: () => void;
  startMissionReady: boolean;
  publishLobbyMessage: <K extends LobbyMessageKind>(
    kind: K,
    body: LobbyMessageBodies[K],
    context?: string
  ) => boolean;
  registerLobbyHandler: <K extends LobbyMessageKind>(
    kind: K,
    handler: (message: Extract<LobbyMessage, { kind: K }>) => void
  ) => () => void;
};

export function useSession({ startHostSession: startHost, joinHostSession: joinHost }: UseSessionDeps): UseSessionResult {
  const lobbyStore = useLobbyStore();
  const lobbyBus = useLobbyBus();
  const signalBridge = useSignalBridge();
  const globalBus = useGlobalBus();
  const gameBus = useGameBus();

  const [sessionMeta, setSessionMeta] = useState<SessionMeta>(null);

  const sessionRef = useRef<HostLobbySession | GuestLobbySession | null>(null);
  const modeRef = useRef<SessionMode | null>(null);
  const pendingOfferRef = useRef<Promise<void> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const renegotiateAttemptsRef = useRef(0);
  const renegotiateInFlightRef = useRef(false);

  const clearDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, []);

  // Define leaveSession earlier so we can schedule timeouts without TS hoisting errors
  const leaveSession = useCallback(() => {
    if (modeRef.current === 'guest') {
      const localId = lobbyStore.localParticipantIdRef.current;
      if (localId) {
        try {
          const session = sessionRef.current;
          if (session?.channel.readyState === 'open') {
            const envelope = createLobbyMessage('leave', { participantId: localId });
            session.channel.send(JSON.stringify(envelope));
            console.info('[lobby] send', { context: 'guest-leave-inline', kind: 'leave' });
          } else {
            console.info('[lobby] leave queued/skipped – channel not open');
          }
        } catch (error) {
          console.warn('[lobby] failed to send leave inline', error);
        }
      }
    }

    sessionRef.current?.close();
    sessionRef.current = null;
    modeRef.current = null;
    pendingOfferRef.current = null;
    renegotiateAttemptsRef.current = 0;
    renegotiateInFlightRef.current = false;
    pendingMessagesRef.current = [];

    signalBridge.disconnect(1000, 'session-leave');

    lobbyStore.setLocalParticipantId(null);
    lobbyStore.replaceFromWire([]);
    globalBus.publish('session:state', { mode: 'idle' });
    gameBus.publish('lobby:ready-state', { ready: false, participants: 0 });
    gameBus.publish('lobby:participants', { participants: [] });
    setSessionMeta(null);
  }, [gameBus, globalBus, lobbyStore, signalBridge]);

  const scheduleDisconnectTimeout = useCallback(
    (reason: string, ms = 40000) => {
      clearDisconnectTimer();
      disconnectTimerRef.current = window.setTimeout(() => {
        console.warn('[webrtc] connection timeout; leaving session', { reason });
        leaveSession();
      }, ms);
    },
    [clearDisconnectTimer, leaveSession]
  );

  const requestIceRestartHost = useCallback(
    async (reason: string) => {
      if (modeRef.current !== 'host') return;
      const current = sessionRef.current as HostLobbySession | null;
      if (!current) return;
      if (renegotiateInFlightRef.current) return;
      if (renegotiateAttemptsRef.current >= 5) return;

      renegotiateInFlightRef.current = true;
      const attempt = renegotiateAttemptsRef.current + 1;
      console.warn('[webrtc] attempting ICE restart', { attempt, reason });
      try {
        const code = await current.refreshOffer({ iceRestart: true });
        const ok = signalBridge.sendOffer(code);
        if (!ok) {
          console.warn('[signal] failed to send restart offer');
        }
      } catch (error) {
        console.error('[webrtc] ICE restart failed', error);
      } finally {
        renegotiateAttemptsRef.current = attempt;
        renegotiateInFlightRef.current = false;
      }
    },
    [signalBridge]
  );

  const attachPeerWatchers = useCallback(
    (peer: RTCPeerConnection, role: SessionMode) => {
      const handleConn = () => {
        const st = peer.connectionState;
        console.debug('[webrtc] connectionstatechange', { role, state: st });
        if (st === 'connected') {
          clearDisconnectTimer();
          renegotiateAttemptsRef.current = 0;
        } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
          scheduleDisconnectTimeout(`connection:${st}`);
          if (modeRef.current === 'host') {
            void requestIceRestartHost(`conn:${st}`);
          }
        }
      };
      const handleIce = () => {
        const st = peer.iceConnectionState;
        console.debug('[webrtc] iceconnectionstatechange', { role, state: st });
        if (st === 'connected' || st === 'completed' || st === 'checking') {
          clearDisconnectTimer();
          if (st === 'connected' || st === 'completed') {
            renegotiateAttemptsRef.current = 0;
          }
        } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
          scheduleDisconnectTimeout(`ice:${st}`);
          if (modeRef.current === 'host') {
            void requestIceRestartHost(`ice:${st}`);
          }
        }
      };
      peer.addEventListener('connectionstatechange', handleConn);
      peer.addEventListener('iceconnectionstatechange', handleIce);
    },
    [clearDisconnectTimer, scheduleDisconnectTimeout, requestIceRestartHost]
  );
  const MAX_PENDING_QUEUE = 100;
  const pendingMessagesRef = useRef<{
    context: string;
    kind: LobbyMessageKind;
    payload: string;
  }[]>([]);

  const publishLobbyMessage = useCallback(
    <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context = 'external') => {
      const session = sessionRef.current;
      if (!session) {
        console.warn('[lobby] send skipped – no session', { context, kind, body });
        return false;
      }
      const { channel } = session;
      const envelope = createLobbyMessage(kind, body);
      // Echo to local subscribers immediately so UI reflects own messages even if channel is closed.
      lobbyBus.publish(envelope);
      if (channel.readyState !== 'open') {
        // Keep queue bounded to MAX_PENDING_QUEUE by dropping oldest first
        while (pendingMessagesRef.current.length >= MAX_PENDING_QUEUE) {
          pendingMessagesRef.current.shift();
          console.warn('[lobby] pending queue overflow – dropping oldest message');
        }
        pendingMessagesRef.current.push({
          context,
          kind,
          payload: JSON.stringify(envelope)
        });
        console.info('[lobby] queued message – channel not open', {
          context,
          state: channel.readyState,
          kind,
          queued: pendingMessagesRef.current.length
        });
        return false;
      }
      channel.send(JSON.stringify(envelope));
      console.info('[lobby] send', { context, kind, body });
      return true;
    },
    [lobbyBus]
  );

  const registerLobbyHandler = useCallback(
    <K extends LobbyMessageKind>(
      kind: K,
      handler: (message: Extract<LobbyMessage, { kind: K }>) => void
    ) => lobbyBus.subscribe(kind, handler),
    [lobbyBus]
  );

  const broadcastState = useCallback(
    (context: string) => {
      if (modeRef.current !== 'host') return;
      const payload = lobbyStore.snapshotWire();
      publishLobbyMessage('state', { participants: payload }, context);
    },
    [lobbyStore, publishLobbyMessage]
  );

  // leaveSession defined above

  const handleMessage = useCallback(
    (payload: unknown) => {
      const message = parseLobbyMessage(payload);
      if (!message) {
        console.warn('[lobby] unknown payload', payload);
        return;
      }

      switch (message.kind) {
        case 'hello':
          if (modeRef.current === 'host') {
            console.info('[lobby] hello', message.body.participant);
            lobbyStore.upsertFromWire(message.body.participant);
            broadcastState('hello');
          }
          break;
        case 'state':
          if (modeRef.current === 'guest') {
            console.info('[lobby] state', message.body.participants);
            lobbyStore.replaceFromWire(message.body.participants);
          }
          break;
        case 'ready':
          if (modeRef.current === 'host') {
            console.info('[lobby] ready update', message.body);
            const raw = lobbyStore.snapshotWire().map((participant) =>
              participant.id === message.body.participantId
                ? { ...participant, ready: message.body.ready }
                : participant
            );
            lobbyStore.replaceFromWire(raw);
            broadcastState('ready-update');
          }
          break;
        case 'leave':
          console.info('[lobby] leave notice', message.body);
          lobbyStore.remove(message.body.participantId);
          if (modeRef.current === 'host') {
            broadcastState('leave-relay');
          } else if (message.body.participantId !== lobbyStore.localParticipantIdRef.current) {
            leaveSession();
          }
          break;
        default:
          break;
      }

      lobbyBus.publish(message);
    },
    [broadcastState, leaveSession, lobbyBus, lobbyStore]
  );

  const handleChannelOpen = useCallback(
    (channel: RTCDataChannel) => {
      console.info('[lobby] channel open', { mode: modeRef.current, state: channel.readyState });
      if (pendingMessagesRef.current.length > 0) {
        const pending = pendingMessagesRef.current.splice(0, pendingMessagesRef.current.length);
        for (const message of pending) {
          channel.send(message.payload);
          console.info('[lobby] send', {
            context: `${message.context}-flush`,
            kind: message.kind,
            queued: true
          });
        }
      }
      if (modeRef.current === 'host') {
        broadcastState('channel-open host');
      } else {
        const localId = lobbyStore.localParticipantIdRef.current;
        if (localId) {
          const self = lobbyStore.participantsRef.current.find((participant) => participant.id === localId);
          if (self) {
            publishLobbyMessage('hello', { participant: lobbyStore.toWire(self) }, 'channel-open hello');
          }
        }
      }
    },
    [broadcastState, lobbyStore, publishLobbyMessage]
  );

  const handleChannelClose = useCallback(
    (event: Event) => {
      console.warn('[lobby] channel closed', { mode: modeRef.current, event });
      if (modeRef.current === 'host') {
        const hostOnly = lobbyStore.hostSnapshot();
        lobbyStore.replaceFromWire(hostOnly);
      } else {
        leaveSession();
      }
    },
    [leaveSession, lobbyStore]
  );

  const handleChannelError = useCallback((event: Event) => {
    console.warn('[lobby] channel error', event);
  }, []);

  const events: RTCBridgeEvents = useMemo(
    () => ({
      onMessage: (payload) => handleMessage(payload),
      onOpen: handleChannelOpen,
      onClose: handleChannelClose,
      onError: handleChannelError
    }),
    [handleChannelClose, handleChannelError, handleChannelOpen, handleMessage]
  );

  const createGame = useCallback(
    async (name: string) => {
      signalBridge.disconnect(1000, 'session-refresh-host');
      pendingOfferRef.current = null;
      pendingMessagesRef.current = [];

      const tag = generateUserTag();
      const id = nanoid(8);

      let signalSessionId: string | null = null;
      let forwardOffer: (() => Promise<void>) | null = null;

      const relayIceCandidate = (candidate: RTCIceCandidateInit) => {
        if (!signalSessionId) return;
        if (!signalBridge.sendCandidate(candidate)) {
          console.debug('[signal] candidate skipped – socket not open (host)');
        }
      };

      if (!SIGNAL_SERVER_AVAILABLE) {
        throw new Error('시그널 서버가 활성화되지 않았습니다. 관리자에게 문의해 주세요.');
      }

      try {
        signalSessionId = await requestSignalSessionId();
        await signalBridge.connect(signalSessionId, 'host', {
          onOffer: async (offer) => {
            // 호스트는 외부에서 온 offer를 처리하지 않습니다(권위 유지)
            console.debug('[signal] unexpected offer received at host (ignored)', { len: offer.length });
          },
          onAnswer: async (answerCode) => {
            console.info('[signal] answer received', {
              sessionId: signalSessionId,
              answerCodeLength: answerCode.length
            });
            if (modeRef.current !== 'host') return;
            try {
              const currentSession = sessionRef.current as HostLobbySession | null;
              if (!currentSession) return;
              if (pendingOfferRef.current) {
                await pendingOfferRef.current.catch((error: unknown) => {
                  console.warn('[signal] pending offer refresh failed before answer', error);
                });
              }
              await currentSession.acceptAnswer(answerCode);
            } catch (error) {
              console.error('[signal] failed to apply answer', error);
            }
          },
          onCandidate: async (candidateJson) => {
            if (modeRef.current !== 'host') return;
            try {
              const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
              await (sessionRef.current as HostLobbySession | null)?.peer.addIceCandidate(candidate);
            } catch (error) {
              console.warn('[signal] failed to apply candidate (host)', error);
            }
          },
          onPeerConnected: () => {
            console.info('[signal] peer connected (host)', { sessionId: signalSessionId });
            // Avoid sending a re-offer on connect; initial offer is already in flight via `forwardOffer()`.
          },
          onPeerDisconnected: () => {
            console.info('[signal] peer disconnected (host)', { sessionId: signalSessionId });
            if (modeRef.current === 'host') {
              const hostOnly = lobbyStore.hostSnapshot();
              lobbyStore.replaceFromWire(hostOnly);
            }
          }
        });
      } catch (error) {
        console.warn('[signal] host bridge connection failed', error);
        globalBus.publish('error:show', {
          message: '시그널 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          context: 'host-signal-connect',
          cause: error
        });
        signalBridge.disconnect(1011, 'signal-unavailable');
        throw new Error('시그널 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      }

      const session = await startHost(events, relayIceCandidate);
      attachPeerWatchers(session.peer, 'host');

      modeRef.current = 'host';
      sessionRef.current = session;
      lobbyStore.setLocalParticipantId(id);

      const sessionCode = signalSessionId ?? session.offerCode;
      setSessionMeta({
        mode: 'host',
        session,
        code: sessionCode,
        signalSessionId
      });

      const hostParticipant: SessionWireParticipant = { id, name, tag, ready: false, role: 'host' };
      lobbyStore.replaceFromWire([hostParticipant]);
      globalBus.publish('session:state', { mode: 'host', code: sessionCode, participants: 1 });

      forwardOffer = async () => {
        const currentSession = sessionRef.current as HostLobbySession | null;
        if (!currentSession) {
          console.warn('[signal] cannot send offer – no active host session');
          return;
        }

        const refreshPromise = currentSession
          .refreshOffer({ iceRestart: true })
          .then((code) => {
            console.info('[signal] sending offer to peer', {
              sessionId: signalSessionId,
              hasSession: Boolean(sessionRef.current),
              offerLength: code.length
            });
            if (!signalBridge.sendOffer(code)) {
              console.warn('[signal] failed to send offer payload');
            }
          })
          .catch((error: unknown) => {
            console.error('[signal] failed to refresh offer', error);
            throw error;
          })
          .finally(() => {
            pendingOfferRef.current = null;
          });

        pendingOfferRef.current = refreshPromise;
        await refreshPromise;
      };

      await forwardOffer();
    },
    [events, globalBus, lobbyStore, signalBridge, startHost, attachPeerWatchers]
  );

  const joinGame = useCallback(
    async (name: string, code: string) => {
      signalBridge.disconnect(1000, 'session-refresh-guest');
      pendingOfferRef.current = null;
      pendingMessagesRef.current = [];

      const tag = generateUserTag();
      const id = nanoid(8);

      const trimmedInput = code.trim();
      const upperInput = trimmedInput.toUpperCase();

      if (!SIGNAL_SERVER_AVAILABLE) {
        throw new Error('시그널 서버를 사용할 수 없습니다. 관리자에게 문의해 주세요.');
      }

      if (!isLikelySignalCode(upperInput)) {
        throw new Error('유효한 세션 코드를 입력해 주세요. (예: ABC-DEF-GHI)');
      }

      const offerPromise = createDeferred<string>();
      let offerResolved = false;
      console.info('[signal] waiting for offer via socket', { sessionId: upperInput });

      const relayIceCandidate = (candidate: RTCIceCandidateInit) => {
        if (!signalBridge.sendCandidate(candidate)) {
          console.debug('[signal] candidate skipped – socket not open (guest)');
        }
      };

      try {
        await signalBridge.connect(upperInput, 'guest', {
          onOffer: async (offer: string) => {
            console.info('[signal] offer received via socket', {
              sessionId: upperInput,
              offerLength: offer.length
            });
            if (!offerResolved) {
              offerResolved = true;
              offerPromise.resolve(offer);
              return;
            }

            // 재협상(ICE Restart) 처리: 기존 피어에 새로운 offer 적용 후 answer 전송
            if (modeRef.current !== 'guest') return;
            const active = sessionRef.current as GuestLobbySession | null;
            if (!active) return;
            try {
              const decoded = atob(offer);
              const restored = decodeURIComponent(decoded);
              const signal = JSON.parse(restored) as { type: 'offer' | 'answer'; sdp: string };
              if (signal.type !== 'offer') return;

              if (active.peer.signalingState !== 'stable') {
                try {
                  type WithRollback = RTCPeerConnection & {
                    setLocalDescription: (
                      desc: RTCSessionDescriptionInit | { type: 'rollback' }
                    ) => Promise<void>;
                  };
                  await (active.peer as WithRollback).setLocalDescription({ type: 'rollback' });
                } catch (err) {
                  console.debug('[webrtc] rollback before restart offer failed', err);
                }
              }

              await active.peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
              const answer = await active.peer.createAnswer();
              await active.peer.setLocalDescription(answer);
              const answerSignal = { type: 'answer', sdp: answer.sdp ?? '' };
              const payload = btoa(encodeURIComponent(JSON.stringify(answerSignal)));
              if (!signalBridge.sendAnswer(payload)) {
                console.warn('[signal] failed to send restart answer');
              }
            } catch (error) {
              console.error('[webrtc] failed to apply restart offer (guest)', error);
            }
          },
          onCandidate: async (candidateJson: string) => {
            if (modeRef.current !== 'guest') return;
            try {
              const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
              await (sessionRef.current as GuestLobbySession | null)?.peer.addIceCandidate(candidate);
            } catch (error) {
              console.warn('[signal] failed to apply candidate (guest)', error);
            }
          },
          onPeerDisconnected: () => {
            if (modeRef.current === 'guest') {
              leaveSession();
            }
          }
        });
      } catch (error) {
        console.warn('[signal] unable to use signaling server', error);
        globalBus.publish('error:show', {
          message: '시그널 서버 연결에 실패했습니다. 호스트 상태를 확인하거나 잠시 후 다시 시도해 주세요.',
          context: 'guest-signal-connect',
          cause: error
        });
        signalBridge.disconnect(1011, 'guest-signal-failed');
        throw new Error('시그널 서버 연결에 실패했습니다. 호스트 상태를 확인하거나 잠시 후 다시 시도해 주세요.');
      }

      const timeout = window.setTimeout(() => {
        offerPromise.reject(new Error('Timed out waiting for host offer'));
      }, 15000);

      let joinCode: string;
      try {
        joinCode = await offerPromise.promise;
      } finally {
        window.clearTimeout(timeout);
      }

      console.info('[signal] attempting joinHost', {
        usingSignal: true,
        joinCodePreview: joinCode.slice(0, 32)
      });

      let session: GuestLobbySession;
      try {
        session = await joinHost(
          joinCode,
          events,
          (answerCode) => {
            console.info('[signal] sending answer via socket', {
              sessionId: upperInput,
              answerLength: answerCode.length
            });
            if (!signalBridge.sendAnswer(answerCode)) {
              console.error('[signal] failed to send answer payload');
            }
          },
          relayIceCandidate
        );
      } catch (error) {
        console.error('[signal] joinHost failed', {
          joinCodePreview: joinCode.slice(0, 32),
          error
        });
        globalBus.publish('error:show', {
          message: '세션에 합류하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
          context: 'guest-join',
          cause: error
        });
        throw error;
      }

      console.info('[signal] joinHost completed', { usingSignal: true, joinCodeLength: joinCode.length });
      attachPeerWatchers(session.peer, 'guest');

      modeRef.current = 'guest';
      sessionRef.current = session;
      lobbyStore.setLocalParticipantId(id);

      setSessionMeta({
        mode: 'guest',
        session,
        code: upperInput,
        answerCode: session.answerCode,
        signalSessionId: upperInput
      });

      const placeholder: SessionWireParticipant = {
        id: 'host-placeholder',
        name: 'Awaiting Host Sync',
        tag: '#HOST',
        ready: false,
        role: 'host'
      };
      const self: SessionWireParticipant = { id, name, tag, ready: false, role: 'guest' };
      lobbyStore.replaceFromWire([placeholder, self]);
      globalBus.publish('session:state', {
        mode: 'guest',
        code: upperInput,
        participants: lobbyStore.participantsRef.current.length
      });

    },
    [events, globalBus, joinHost, leaveSession, lobbyStore, signalBridge, attachPeerWatchers]
  );

  const toggleReady = useCallback(
    (participantId: string) => {
      const raw = lobbyStore.snapshotWire();
      const target = raw.find((participant) => participant.id === participantId);
      const nextReady = target ? !target.ready : true;
      const updated = raw.map((participant) =>
        participant.id === participantId ? { ...participant, ready: nextReady } : participant
      );
      lobbyStore.replaceFromWire(updated);

      if (participantId === lobbyStore.localParticipantIdRef.current) {
        if (modeRef.current === 'guest') {
          publishLobbyMessage('ready', { participantId, ready: nextReady }, 'ready-toggle guest');
        } else if (modeRef.current === 'host') {
          broadcastState('ready-toggle host');
        }
      } else if (modeRef.current === 'host') {
        broadcastState('ready-toggle host remote');
      }
    },
    [broadcastState, lobbyStore, publishLobbyMessage]
  );

  const startMissionReady = useMemo(
    () => lobbyStore.participants.length > 0 && lobbyStore.participants.every((participant) => participant.ready),
    [lobbyStore.participants]
  );

  useEffect(() => {
    gameBus.publish('lobby:participants', { participants: lobbyStore.participants });
  }, [gameBus, lobbyStore.participants]);

  useEffect(() => {
    gameBus.publish('lobby:ready-state', {
      ready: startMissionReady,
      participants: lobbyStore.participants.length
    });
  }, [gameBus, lobbyStore.participants.length, startMissionReady]);

  useEffect(() => {
    if (!sessionMeta) {
      globalBus.publish('session:state', { mode: 'idle' });
      return;
    }
    globalBus.publish('session:state', {
      mode: sessionMeta.mode,
      code: sessionMeta.code,
      participants: lobbyStore.participants.length
    });
  }, [globalBus, lobbyStore.participants.length, sessionMeta]);

  useEffect(
    () => () => {
      sessionRef.current?.close();
      sessionRef.current = null;
      signalBridge.disconnect(1000, 'component-unmount');
    },
    [signalBridge]
  );

  return {
    participants: lobbyStore.participants,
    localParticipantId: lobbyStore.localParticipantId,
    sessionMeta,
    createGame,
    joinGame,
    toggleReady,
    leaveSession,
    startMissionReady,
    publishLobbyMessage,
    registerLobbyHandler
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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
import { HostPeerManager } from './host-peer-manager';
import { PARTICIPANTS_OBJECT_ID } from '../net-objects/participants';
import { HostNetController } from '../net-objects/host-controller';
import { ClientNetController } from '../net-objects/client-controller';
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
  const hostPeersRef = useRef<HostPeerManager | null>(null);
  const hostControllerRef = useRef<HostNetController | null>(null);
  const clientControllerRef = useRef<ClientNetController | null>(null);
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
    // no-op: message queuing removed

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
      // Prefer per-guest restart via HostPeerManager when available
      const manager = hostPeersRef.current;
      if (manager) {
        console.warn('[webrtc] attempting per-guest ICE restart', { reason });
        try {
          manager.forEach(async ({ peerId }) => {
            try {
              const code = await manager.createOffer(peerId, { iceRestart: true });
              const ok = signalBridge.sendOffer(code, peerId);
              if (!ok) console.warn('[signal] failed to send per-guest restart offer', { peerId });
            } catch (err) {
              console.error('[webrtc] per-guest ICE restart failed', { peerId, err });
            }
          });
        } catch (err) {
          console.error('[webrtc] per-guest restart iteration failed', err);
        }
        return;
      }
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
  // Message queuing removed: send only when channel(s) are open

  const publishLobbyMessage = useCallback(
    <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context = 'external') => {
      const envelope = createLobbyMessage(kind, body);
      // 항상 로컬에 에코해 UI 즉시 반영
      lobbyBus.publish(envelope);

      // 호스트: 멀티 피어 매니저가 있으면 브로드캐스트
      if (modeRef.current === 'host' && hostPeersRef.current) {
        hostPeersRef.current.sendAll(envelope);
        if (kind === 'llm:progress' || context === 'llm-progress') {
          console.debug('[lobby] broadcast', { context, kind });
        } else {
          console.info('[lobby] broadcast', { context, kind });
        }
        return true;
      }

      // 게스트/레거시 단일 채널 경로
      const session = sessionRef.current;
      if (!session) {
        console.warn('[lobby] send skipped – no session', { context, kind });
        return false;
      }
      const { channel } = session;
      if (channel.readyState !== 'open') return false;
      channel.send(JSON.stringify(envelope));
      if (kind === 'llm:progress' || context === 'llm-progress') {
        console.debug('[lobby] send', { context, kind });
      } else {
        console.info('[lobby] send', { context, kind });
      }
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

  // leaveSession defined above


  const handleChannelOpen = useCallback(
    (channel: RTCDataChannel) => {
      console.info('[lobby] channel open', { mode: modeRef.current, state: channel.readyState });

      // Queuing removed: do not flush any backlog

      if (modeRef.current === 'host') {
        // Host binding occurs where peers are created (HostPeerManager onOpen)
      } else {
        // Guest: say hello and request authoritative snapshots, then bind client controller
        const localId = lobbyStore.localParticipantIdRef.current;
        if (localId) {
          const self = lobbyStore.participantsRef.current.find((participant) => participant.id === localId);
          if (self) {
            publishLobbyMessage('hello', { participant: lobbyStore.toWire(self) }, 'channel-open hello');
          }
        }
        clientControllerRef.current?.bindChannel(channel);
        clientControllerRef.current?.requestSnapshots();
      }
    },
    [lobbyStore, publishLobbyMessage]
  );

  const handleChannelClose = useCallback(
    (event: Event) => {
      console.warn('[lobby] channel closed', { mode: modeRef.current, event });
      // Host: ignore individual per-guest channel closures here.
      // Precise removal is handled via signal 'peer-disconnected' in HostRouter.
      if (modeRef.current === 'guest') {
        leaveSession();
      }
    },
    [leaveSession]
  );

  const handleChannelError = useCallback((event: Event) => {
    console.warn('[lobby] channel error', event);
  }, []);

  const events: RTCBridgeEvents = useMemo(
    () => ({
      // Controllers bind their own channel message handlers; keep this a no-op
      onMessage: () => {},
      onOpen: handleChannelOpen,
      onClose: handleChannelClose,
      onError: handleChannelError
    }),
    [handleChannelClose, handleChannelError, handleChannelOpen]
  );

  // Guest peerId received via signal ack
  const guestPeerIdRef = useRef<string | null>(null);

  const createGame = useCallback(
    async (name: string) => {
      signalBridge.disconnect(1000, 'session-refresh-host');
      pendingOfferRef.current = null;

      const tag = generateUserTag();
      const id = nanoid(8);

      let signalSessionId: string | null = null;
      let forwardOffer: (() => Promise<void>) | null = null;

      // For multi-guest architecture, do NOT relay ICE from the legacy base host peer.
      // Per-guest peers created in onPeerConnected will send candidates with peerId.
      const relayIceCandidate = (_candidate: RTCIceCandidateInit) => {
        return;
      };

      if (!SIGNAL_SERVER_AVAILABLE) {
        throw new Error('시그널 서버가 활성화되지 않았습니다. 관리자에게 문의해 주세요.');
      }

      try {
        signalSessionId = await requestSignalSessionId();
        const hostPeerManager = new HostPeerManager({
          onMessage: () => {},
          onOpen: (channel) => {
            // Host controller binding by peer will be added with peerId below
            handleChannelOpen(channel);
          },
          onClose: handleChannelClose,
          onError: handleChannelError
        });
        hostPeersRef.current = hostPeerManager;
        hostControllerRef.current = new HostNetController({
          publish: (kind, body, context) => publishLobbyMessage(kind as any, body as any, context),
          lobbyStore,
          busPublish: (message) => lobbyBus.publish(message)
        });

        await signalBridge.connect(signalSessionId, 'host', {
          onPeerConnected: async ({ peerId }) => {
            console.info('[signal] peer connected (host)', { sessionId: signalSessionId, peerId });
            try {
              hostControllerRef.current?.onPeerConnected(peerId);
              const entry = await hostPeerManager.create(peerId);
              entry.channel.addEventListener('open', () => {
                hostControllerRef.current?.bindChannel(entry.channel, peerId);
              });
              entry.peer.addEventListener('icecandidate', (event) => {
                if (!event.candidate) return;
                try {
                  signalBridge.sendCandidate(event.candidate.toJSON(), peerId);
                } catch (error) {
                  console.warn('[signal] candidate send failed (host)', error);
                }
              });
              const offerCode = await hostPeerManager.createOffer(peerId, { iceRestart: true });
              if (!signalBridge.sendOffer(offerCode, peerId)) {
                console.warn('[signal] failed to send offer payload', { peerId });
              }
            } catch (error) {
              console.error('[host] failed to create peer for', peerId, error);
            }
          },
          onAnswer: async ({ code, peerId }) => {
            if (!peerId) return;
            if (modeRef.current !== 'host') return;
            try {
              await hostPeerManager.applyAnswer(peerId, code);
            } catch (error) {
              console.error('[signal] failed to apply answer', error);
            }
          },
          onCandidate: async ({ candidate, peerId }) => {
            if (!peerId) return;
            if (modeRef.current !== 'host') return;
            try {
              const json = JSON.parse(candidate) as RTCIceCandidateInit;
              await hostPeerManager.get(peerId)?.peer.addIceCandidate(json);
            } catch (error) {
              console.warn('[signal] failed to apply candidate (host)', error);
            }
          },
          onPeerDisconnected: ({ peerId }) => {
            console.info('[signal] peer disconnected (host)', { sessionId: signalSessionId, peerId });
            void hostPeerManager.close(peerId);
            hostControllerRef.current?.onPeerDisconnected(peerId);
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

      forwardOffer = async () => undefined;
    },
    [events, globalBus, lobbyStore, signalBridge, startHost, attachPeerWatchers, lobbyBus]
  );

  const joinGame = useCallback(
    async (name: string, code: string) => {
      signalBridge.disconnect(1000, 'session-refresh-guest');
      pendingOfferRef.current = null;

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
          onAck: ({ peerId }) => {
            guestPeerIdRef.current = peerId ?? null;
          },
          onOffer: async ({ code: offerCode }) => {
            console.info('[signal] offer received via socket', {
              sessionId: upperInput,
              offerLength: offerCode.length
            });
            if (!offerResolved) {
              offerResolved = true;
              offerPromise.resolve(offerCode);
              return;
            }

            // 재협상(ICE Restart) 처리: 기존 피어에 새로운 offer 적용 후 answer 전송
            if (modeRef.current !== 'guest') return;
            const active = sessionRef.current as GuestLobbySession | null;
            if (!active) return;
            try {
              const decoded = atob(offerCode);
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
          onCandidate: async ({ candidate: candidateJson }) => {
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
          (candidate) => {
            if (!signalBridge.sendCandidate(candidate)) {
              console.debug('[signal] candidate skipped – socket not open (guest)');
            }
          }
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

      // Instantiate client-side controller for net objects
      clientControllerRef.current = new ClientNetController({
        publish: (kind, body, context) => publishLobbyMessage(kind as any, body as any, context),
        lobbyStore,
        busPublish: (message) => lobbyBus.publish(message)
      });

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
          hostControllerRef.current?.updateParticipantReady(participantId, nextReady, 'ready:host-toggle');
        }
      } else if (modeRef.current === 'host') {
        hostControllerRef.current?.updateParticipantReady(participantId, nextReady, 'ready:host-remote-toggle');
      }
    },
    [lobbyStore, publishLobbyMessage]
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

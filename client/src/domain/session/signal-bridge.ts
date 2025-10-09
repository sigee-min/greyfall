import { useCallback, useMemo, useRef } from 'react';
import { SIGNAL_SERVER_ENABLED, buildSignalWsUrl, buildSignalHttpUrl } from '../../lib/config';
import { createSignalClientMessage, parseSignalServerMessage, type SignalClientBodies } from '../../protocol';
import type { SessionMode } from './types';

export type SignalBridgeHandlers = {
  onAck?: (payload: { role: 'host' | 'guest'; sessionId: string; peerId?: string | null }) => void;
  onOffer?: (payload: { code: string; peerId?: string | null }) => void;
  onAnswer?: (payload: { code: string; peerId?: string | null }) => void;
  onCandidate?: (payload: { candidate: string; peerId?: string | null }) => void;
  onPeerConnected?: (payload: { peerId: string }) => void;
  onPeerDisconnected?: (payload: { peerId: string }) => void;
};

export type SignalBridge = {
  connect: (sessionId: string, role: SessionMode, handlers: SignalBridgeHandlers) => Promise<void>;
  disconnect: (code?: number, reason?: string) => void;
  sendOffer: (code: string, peerId?: string) => boolean;
  sendAnswer: (code: string, peerId?: string) => boolean;
  sendCandidate: (candidate: RTCIceCandidateInit, peerId?: string) => boolean;
  getSessionId: () => string | null;
  getSocket: () => WebSocket | null;
  isOpen: () => boolean;
};

export function useSignalBridge(): SignalBridge {
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const handlersRef = useRef<SignalBridgeHandlers>({});
  type OutboxItem =
    | { kind: 'offer'; payload: SignalClientBodies['offer'] }
    | { kind: 'answer'; payload: SignalClientBodies['answer'] }
    | { kind: 'candidate'; payload: SignalClientBodies['candidate'] };
  const outboxRef = useRef<OutboxItem[]>([]);

  const disconnect = useCallback((code = 1000, reason = 'signal-disconnect') => {
    const socket = socketRef.current;
    socketRef.current = null;
    sessionIdRef.current = null;
    handlersRef.current = {};
    if (!socket) return;
    try {
      socket.close(code, reason);
    } catch (error) {
      console.warn('[signal] failed to close socket', error);
    }
  }, []);

  const isOpen = useCallback(() => socketRef.current?.readyState === WebSocket.OPEN, []);

  const connect = useCallback(
    async (sessionId: string, role: SessionMode, handlers: SignalBridgeHandlers) => {
      disconnect();
      handlersRef.current = handlers;
      sessionIdRef.current = sessionId;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const wsUrl = buildSignalWsUrl(sessionId, role);
        const socket = new WebSocket(wsUrl);

        const teardown = () => {
          socket.removeEventListener('open', handleOpen);
          socket.removeEventListener('error', handleError);
        };

        const handleOpen = () => {
          settled = true;
          teardown();
          socketRef.current = socket;
          // Flush any queued messages that were generated before the socket was open
          const pending = outboxRef.current.splice(0, outboxRef.current.length);
          for (const item of pending) {
            try {
              socket.send(JSON.stringify(createSignalClientMessage(item.kind, item.payload as never)));
            } catch (error) {
              console.warn('[signal] failed to flush queued payload', { kind: item.kind, error });
              // Put it back to the front of the queue and break; we'll try later
              outboxRef.current.unshift(item);
              break;
            }
          }
          resolve();
        };

        const handleError = (event: Event) => {
          if (settled) return;
          settled = true;
          teardown();
          sessionIdRef.current = null;
          socketRef.current = null;
          reject(new Error(`Signal socket error: ${event.type}`));
        };

        socket.addEventListener('open', handleOpen, { once: true });
        socket.addEventListener('error', handleError, { once: true });

        socket.addEventListener('message', (event) => {
          let raw: unknown;
          try {
            raw = JSON.parse(event.data as string) as unknown;
          } catch (error) {
            console.warn('[signal] failed to parse message', error);
            return;
          }

          const message = parseSignalServerMessage(raw);
          if (!message) {
            console.warn('[signal] received malformed payload', raw);
            return;
          }

          const currentHandlers = handlersRef.current;
          switch (message.kind) {
            case 'ack':
              currentHandlers.onAck?.({ role: message.body.role, sessionId: message.body.sessionId, peerId: message.body.peerId });
              break;
            case 'offer':
              currentHandlers.onOffer?.({ code: message.body.code, peerId: message.body.peerId });
              break;
            case 'answer':
              currentHandlers.onAnswer?.({ code: message.body.code, peerId: message.body.peerId });
              break;
            case 'candidate':
              currentHandlers.onCandidate?.({ candidate: message.body.candidate, peerId: message.body.peerId });
              break;
            case 'peer-connected':
              currentHandlers.onPeerConnected?.({ peerId: message.body.peerId });
              break;
            case 'peer-disconnected':
              currentHandlers.onPeerDisconnected?.({ peerId: message.body.peerId });
              break;
            default:
              break;
          }
        });
      });
    },
    [disconnect]
  );

  const sendEnvelope = useCallback(
    <K extends 'offer' | 'answer' | 'candidate'>(kind: K, payload: SignalClientBodies[K]) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        // Queue to send once the socket opens
        outboxRef.current.push({ kind, payload } as OutboxItem);
        return true;
      }
      try {
        socket.send(JSON.stringify(createSignalClientMessage(kind, payload)));
        return true;
      } catch (error) {
        console.warn('[signal] failed to send payload; enqueuing', { kind, error });
        outboxRef.current.push({ kind, payload } as OutboxItem);
        return false;
      }
    },
    []
  );

  const sendOffer = useCallback((code: string, peerId?: string) => sendEnvelope('offer', { code, peerId }), [sendEnvelope]);
  const sendAnswer = useCallback((code: string, peerId?: string) => sendEnvelope('answer', { code, peerId }), [sendEnvelope]);
  const sendCandidate = useCallback(
    (candidate: RTCIceCandidateInit, peerId?: string) => {
      if (!candidate || !candidate.candidate) return false;
      try {
        const payload = JSON.stringify(candidate);
        return sendEnvelope('candidate', { candidate: payload, peerId });
      } catch (error) {
        console.warn('[signal] serialise candidate failed', error);
        return false;
      }
    },
    [sendEnvelope]
  );

  return useMemo(
    () => ({
      connect,
      disconnect,
      sendOffer,
      sendAnswer,
      sendCandidate,
      getSessionId: () => sessionIdRef.current,
      getSocket: () => socketRef.current,
      isOpen
    }),
    [connect, disconnect, isOpen, sendAnswer, sendCandidate, sendOffer]
  );
}

export function isLikelySignalCode(code: string) {
  return SIGNAL_SERVER_ENABLED && /^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}$/.test(code);
}

export async function requestSignalSessionId() {
  const response = await fetch(buildSignalHttpUrl('/sessions'), { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to create signal session (${response.status})`);
  }
  const json = (await response.json()) as { sessionId: string };
  return json.sessionId.toUpperCase();
}
export const SIGNAL_SERVER_AVAILABLE = SIGNAL_SERVER_ENABLED;

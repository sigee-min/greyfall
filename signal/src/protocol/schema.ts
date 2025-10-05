import { z } from 'zod';

export const RTC_PROTOCOL_VERSION = 1 as const;
export const SIGNAL_SCOPE = 'signal' as const;
export const LOBBY_SCOPE = 'lobby' as const;

export const sessionRoleSchema = z.enum(['host', 'guest']);
export type SessionRole = z.infer<typeof sessionRoleSchema>;

const signalEnvelopeSchema = z.object({
  scope: z.literal(SIGNAL_SCOPE),
  version: z.literal(RTC_PROTOCOL_VERSION)
});

const signalOfferSchema = signalEnvelopeSchema.extend({
  kind: z.literal('offer'),
  body: z.object({ code: z.string().min(10) })
});

const signalAnswerSchema = signalEnvelopeSchema.extend({
  kind: z.literal('answer'),
  body: z.object({ code: z.string().min(10) })
});

const signalCandidateSchema = signalEnvelopeSchema.extend({
  kind: z.literal('candidate'),
  body: z.object({ candidate: z.string().min(1) })
});

const signalPingSchema = signalEnvelopeSchema.extend({
  kind: z.literal('ping'),
  body: z.object({}).strict()
});

const signalAckSchema = signalEnvelopeSchema.extend({
  kind: z.literal('ack'),
  body: z.object({
    role: sessionRoleSchema,
    sessionId: z.string().min(3)
  })
});

const signalPeerConnectedSchema = signalEnvelopeSchema.extend({
  kind: z.literal('peer-connected'),
  body: z.object({}).strict()
});

const signalPeerDisconnectedSchema = signalEnvelopeSchema.extend({
  kind: z.literal('peer-disconnected'),
  body: z.object({}).strict()
});

const signalPongSchema = signalEnvelopeSchema.extend({
  kind: z.literal('pong'),
  body: z.object({}).strict()
});

export const signalClientMessageSchema = z.discriminatedUnion('kind', [
  signalOfferSchema,
  signalAnswerSchema,
  signalCandidateSchema,
  signalPingSchema
]);

export const signalServerMessageSchema = z.discriminatedUnion('kind', [
  signalAckSchema,
  signalOfferSchema,
  signalAnswerSchema,
  signalCandidateSchema,
  signalPeerConnectedSchema,
  signalPeerDisconnectedSchema,
  signalPongSchema
]);

export type SignalClientMessage = z.infer<typeof signalClientMessageSchema>;
export type SignalServerMessage = z.infer<typeof signalServerMessageSchema>;

export type SignalClientKind = SignalClientMessage['kind'];
export type SignalServerKind = SignalServerMessage['kind'];

export type SignalClientBodies = {
  offer: { code: string };
  answer: { code: string };
  candidate: { candidate: string };
  ping: Record<string, never>;
};

export type SignalServerBodies = {
  ack: { role: SessionRole; sessionId: string };
  offer: { code: string };
  answer: { code: string };
  candidate: { candidate: string };
  'peer-connected': Record<string, never>;
  'peer-disconnected': Record<string, never>;
  pong: Record<string, never>;
};

export function createSignalClientMessage<K extends SignalClientKind>(
  kind: K,
  body: SignalClientBodies[K]
): SignalClientMessage {
  return {
    scope: SIGNAL_SCOPE,
    version: RTC_PROTOCOL_VERSION,
    kind,
    body
  } as SignalClientMessage;
}

export function createSignalServerMessage<K extends SignalServerKind>(
  kind: K,
  body: SignalServerBodies[K]
): SignalServerMessage {
  return {
    scope: SIGNAL_SCOPE,
    version: RTC_PROTOCOL_VERSION,
    kind,
    body
  } as SignalServerMessage;
}

export function parseSignalClientMessage(input: unknown): SignalClientMessage | null {
  const result = signalClientMessageSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseSignalServerMessage(input: unknown): SignalServerMessage | null {
  const result = signalServerMessageSchema.safeParse(input);
  return result.success ? result.data : null;
}

export const lobbyParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tag: z.string().min(1),
  ready: z.boolean(),
  role: sessionRoleSchema
});

export type LobbyParticipant = z.infer<typeof lobbyParticipantSchema>;

export const lobbyChatMessageSchema = z.object({
  id: z.string().min(1),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  authorTag: z.string().min(1),
  authorRole: sessionRoleSchema,
  body: z.string().min(1),
  at: z.number().int().nonnegative()
});

export type LobbyChatMessage = z.infer<typeof lobbyChatMessageSchema>;

const lobbyEnvelopeSchema = z.object({
  scope: z.literal(LOBBY_SCOPE),
  version: z.literal(RTC_PROTOCOL_VERSION)
});

const lobbyHelloSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('hello'),
  body: z.object({ participant: lobbyParticipantSchema })
});

const lobbyStateSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('state'),
  body: z.object({ participants: lobbyParticipantSchema.array().max(16) })
});

const lobbyReadySchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('ready'),
  body: z.object({ participantId: z.string().min(1), ready: z.boolean() })
});

const lobbyLeaveSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('leave'),
  body: z.object({ participantId: z.string().min(1) })
});

const lobbyChatSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('chat'),
  body: z.object({ entry: lobbyChatMessageSchema })
});

export const lobbyMessageSchema = z.discriminatedUnion('kind', [
  lobbyHelloSchema,
  lobbyStateSchema,
  lobbyReadySchema,
  lobbyLeaveSchema,
  lobbyChatSchema
]);

export type LobbyMessage = z.infer<typeof lobbyMessageSchema>;
export type LobbyMessageKind = LobbyMessage['kind'];

export type LobbyMessageBodies = {
  hello: { participant: LobbyParticipant };
  state: { participants: LobbyParticipant[] };
  ready: { participantId: string; ready: boolean };
  leave: { participantId: string };
  chat: { entry: LobbyChatMessage };
};

export function createLobbyMessage<K extends LobbyMessageKind>(
  kind: K,
  body: LobbyMessageBodies[K]
): LobbyMessage {
  return {
    scope: LOBBY_SCOPE,
    version: RTC_PROTOCOL_VERSION,
    kind,
    body
  } as LobbyMessage;
}

export function parseLobbyMessage(input: unknown): LobbyMessage | null {
  const result = lobbyMessageSchema.safeParse(input);
  return result.success ? result.data : null;
}

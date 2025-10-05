import { z } from 'zod';
export const RTC_PROTOCOL_VERSION = 1;
export const SIGNAL_SCOPE = 'signal';
export const LOBBY_SCOPE = 'lobby';
export const sessionRoleSchema = z.enum(['host', 'guest']);
const signalEnvelopeSchema = z.object({
    scope: z.literal(SIGNAL_SCOPE),
    version: z.literal(RTC_PROTOCOL_VERSION)
});
const peerIdSchema = z.string().min(1);
const signalOfferSchema = signalEnvelopeSchema.extend({
    kind: z.literal('offer'),
    body: z.object({ code: z.string().min(10), peerId: peerIdSchema.optional() })
});
const signalAnswerSchema = signalEnvelopeSchema.extend({
    kind: z.literal('answer'),
    body: z.object({ code: z.string().min(10), peerId: peerIdSchema.optional() })
});
const signalCandidateSchema = signalEnvelopeSchema.extend({
    kind: z.literal('candidate'),
    body: z.object({ candidate: z.string().min(1), peerId: peerIdSchema.optional() })
});
const signalPingSchema = signalEnvelopeSchema.extend({
    kind: z.literal('ping'),
    body: z.object({}).strict()
});
const signalAckSchema = signalEnvelopeSchema.extend({
    kind: z.literal('ack'),
    body: z.object({
        role: sessionRoleSchema,
        sessionId: z.string().min(3),
        peerId: peerIdSchema.optional()
    })
});
const signalPeerConnectedSchema = signalEnvelopeSchema.extend({
    kind: z.literal('peer-connected'),
    body: z.object({ peerId: peerIdSchema })
});
const signalPeerDisconnectedSchema = signalEnvelopeSchema.extend({
    kind: z.literal('peer-disconnected'),
    body: z.object({ peerId: peerIdSchema })
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
export function createSignalClientMessage(kind, body) {
    return {
        scope: SIGNAL_SCOPE,
        version: RTC_PROTOCOL_VERSION,
        kind,
        body
    };
}
export function createSignalServerMessage(kind, body) {
    return {
        scope: SIGNAL_SCOPE,
        version: RTC_PROTOCOL_VERSION,
        kind,
        body
    };
}
export function parseSignalClientMessage(input) {
    const result = signalClientMessageSchema.safeParse(input);
    return result.success ? result.data : null;
}
export function parseSignalServerMessage(input) {
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
export const lobbyChatMessageSchema = z.object({
    id: z.string().min(1),
    authorId: z.string().min(1),
    authorName: z.string().min(1),
    authorTag: z.string().min(1),
    authorRole: sessionRoleSchema,
    body: z.string().min(1),
    at: z.number().int().nonnegative()
});
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
// Network object sync (host-authoritative)
const patchOpSchema = z.object({
    op: z.enum(['set', 'merge', 'insert', 'remove']),
    path: z.string().optional(),
    value: z.unknown().optional()
});
const lobbyObjectPatchSchema = lobbyEnvelopeSchema.extend({
    kind: z.literal('object:patch'),
    body: z.object({ id: z.string().min(1), rev: z.number().int().nonnegative(), ops: patchOpSchema.array().max(64) })
});
const lobbyObjectReplaceSchema = lobbyEnvelopeSchema.extend({
    kind: z.literal('object:replace'),
    body: z.object({ id: z.string().min(1), rev: z.number().int().nonnegative(), value: z.unknown() })
});
const lobbyObjectRequestSchema = lobbyEnvelopeSchema.extend({
    kind: z.literal('object:request'),
    body: z.object({ id: z.string().min(1), sinceRev: z.number().int().nonnegative().optional() })
});
// Client suggestion (host validates & converts to object patch)
const lobbyChatAppendRequestSchema = lobbyEnvelopeSchema.extend({
    kind: z.literal('chat:append:request'),
    body: z.object({ body: z.string().min(1).max(2000), authorId: z.string().min(1) })
});
export const lobbyMessageSchema = z.discriminatedUnion('kind', [
    lobbyHelloSchema,
    lobbyStateSchema,
    lobbyReadySchema,
    lobbyLeaveSchema,
    lobbyChatSchema,
    lobbyObjectPatchSchema,
    lobbyObjectReplaceSchema,
    lobbyObjectRequestSchema,
    lobbyChatAppendRequestSchema
]);
export function createLobbyMessage(kind, body) {
    return {
        scope: LOBBY_SCOPE,
        version: RTC_PROTOCOL_VERSION,
        kind,
        body
    };
}
export function parseLobbyMessage(input) {
    const result = lobbyMessageSchema.safeParse(input);
    return result.success ? result.data : null;
}

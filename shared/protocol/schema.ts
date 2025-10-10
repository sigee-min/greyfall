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

export type SignalClientMessage = z.infer<typeof signalClientMessageSchema>;
export type SignalServerMessage = z.infer<typeof signalServerMessageSchema>;

export type SignalClientKind = SignalClientMessage['kind'];
export type SignalServerKind = SignalServerMessage['kind'];

export type SignalClientBodies = {
  offer: { code: string; peerId?: string };
  answer: { code: string; peerId?: string };
  candidate: { candidate: string; peerId?: string };
  ping: Record<string, never>;
};

export type SignalServerBodies = {
  ack: { role: SessionRole; sessionId: string; peerId?: string };
  offer: { code: string; peerId?: string };
  answer: { code: string; peerId?: string };
  candidate: { candidate: string; peerId?: string };
  'peer-connected': { peerId: string };
  'peer-disconnected': { peerId: string };
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

const statKeySchema = z.enum(['Strength', 'Agility', 'Engineering', 'Dexterity', 'Medicine']);

const lobbyPassiveSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  negative: z.boolean().optional()
});

const lobbyTraitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().int(),
  statMods: z
    .record(statKeySchema, z.number().int())
    .optional()
  .refine(
      (value: Record<string, number> | undefined) => (value ? Object.keys(value).length > 0 : true),
      'statMods cannot be empty when provided'
    ),
  passives: z.array(lobbyPassiveSchema).max(16).optional(),
  description: z.string().min(1).optional()
});

const lobbyCharacterStatsSchema = z.object({
  Strength: z.number().int(),
  Agility: z.number().int(),
  Engineering: z.number().int(),
  Dexterity: z.number().int(),
  Medicine: z.number().int()
});

const lobbyCharacterLoadoutSchema = z
  .object({
    playerId: z.string().min(1),
    budget: z.literal(10),
    remaining: z.number().int(),
    stats: lobbyCharacterStatsSchema,
    passives: z.array(lobbyPassiveSchema).max(32),
    traits: z.array(lobbyTraitSchema).max(16),
    built: z.boolean(),
    updatedAt: z.number().int().nonnegative()
  })
  .strict();

export type LobbyCharacterLoadout = z.infer<typeof lobbyCharacterLoadoutSchema>;

const lobbyCharacterSnapshotSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('character:snapshot'),
  body: z.object({
    revision: z.number().int().nonnegative(),
    loadouts: z.array(lobbyCharacterLoadoutSchema).max(16)
  })
});

const lobbyCharacterSetSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('character:set'),
  body: z.object({
    playerId: z.string().min(1),
    loadout: lobbyCharacterLoadoutSchema
  })
});

const lobbyCharacterResetSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('character:reset'),
  body: z.object({ playerId: z.string().min(1) })
});

const lobbyCharacterRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('character:request'),
  body: z.object({
    sinceRevision: z.number().int().nonnegative().optional()
  })
});

const lobbyLlmProgressSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('llm:progress'),
  body: z
    .object({
      ready: z.boolean().optional(),
      progress: z.number().min(0).max(1).nullable().optional(),
      status: z.string().min(1).nullable().optional(),
      error: z.string().min(1).nullable().optional(),
      history: z.array(z.string().min(1)).max(16).optional()
    })
    .strict()
});

const lobbyMissionStartSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('mission:start'),
  body: z.object({}).strict()
});

const lobbyLlmConfigSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('llm:config'),
  body: z
    .object({
      modelId: z.string().min(1),
      backend: z.enum(['gpu', 'cpu'])
    })
    .strict()
});

const lobbyObjectPatchSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('object:patch'),
  body: z.object({
    id: z.string().min(1),
    rev: z.number().int().nonnegative(),
    ops: z
      .array(
        z.object({
          op: z.enum(['set', 'merge', 'insert', 'remove']),
          path: z.string().min(1).optional(),
          value: z.any().optional()
        })
      )
      .max(64)
  })
});

const lobbyObjectReplaceSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('object:replace'),
  body: z.object({ id: z.string().min(1), rev: z.number().int().nonnegative(), value: z.any() })
});

const lobbyObjectRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('object:request'),
  body: z.object({ id: z.string().min(1), sinceRev: z.number().int().nonnegative().optional() })
});

const lobbyObjectAckSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('object:ack'),
  body: z.object({ id: z.string().min(1), rev: z.number().int().nonnegative() })
});

const lobbyChatAppendRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('chat:append:request'),
  body: z.object({ body: z.string().min(1).max(2000), authorId: z.string().min(1) })
});

const lobbyFieldMoveRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('field:move:request'),
  body: z.object({
    playerId: z.string().min(1),
    mapId: z.string().min(1),
    fromFieldId: z.string().min(1),
    toFieldId: z.string().min(1)
  })
});

const lobbyMapTravelRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('map:travel:request'),
  body: z
    .object({
      requesterId: z.string().min(1),
      direction: z.enum(['next', 'prev']).optional(),
      toMapId: z.string().min(1).optional()
    })
    .refine((v: { direction?: 'next' | 'prev'; toMapId?: string }) => Boolean(v.direction) !== Boolean(v.toMapId), {
      message: 'Provide either direction or toMapId'
    })
});

const lobbyMapTravelProposeSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('map:travel:propose'),
  body: z
    .object({
      requesterId: z.string().min(1),
      direction: z.enum(['next', 'prev']).optional(),
      toMapId: z.string().min(1).optional(),
      quorum: z.enum(['majority', 'all']).optional()
    })
    .refine((v: { direction?: 'next' | 'prev'; toMapId?: string }) => Boolean(v.direction) !== Boolean(v.toMapId), {
      message: 'Provide either direction or toMapId'
    })
});

const lobbyMapTravelVoteSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('map:travel:vote'),
  body: z.object({ inviteId: z.string().min(6), voterId: z.string().min(1), approve: z.boolean() })
});

const lobbyMapTravelUpdateSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('map:travel:update'),
  body: z.object({
    inviteId: z.string().min(6),
    status: z.enum(['proposed', 'approved', 'rejected', 'cancelled']),
    targetMapId: z.string().min(1),
    yes: z.number().int().nonnegative(),
    no: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    quorum: z.enum(['majority', 'all'])
  })
});

const lobbyMapTravelCancelSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('map:travel:cancel'),
  body: z.object({ inviteId: z.string().min(6), byId: z.string().min(1) })
});

const lobbyInteractInviteSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('interact:invite'),
  body: z.object({
    inviteId: z.string().min(6),
    fromId: z.string().min(1),
    toId: z.string().min(1),
    mapId: z.string().min(1),
    fieldId: z.string().min(1),
    verb: z.string().min(1)
  })
});

const lobbyInteractAcceptSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('interact:accept'),
  body: z.object({ inviteId: z.string().min(6), toId: z.string().min(1) })
});

const lobbyInteractCancelSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('interact:cancel'),
  body: z.object({ inviteId: z.string().min(6), byId: z.string().min(1) })
});

const lobbyInteractConfirmedSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('interact:confirmed'),
  body: z.object({ inviteId: z.string().min(6), fromId: z.string().min(1), toId: z.string().min(1), verb: z.string().min(1) })
});

// Map ping (ephemeral broadcast)
const lobbyMapPingSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('map:ping'),
  body: z.object({
    byId: z.string().min(1),
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    at: z.number().int().nonnegative().optional(),
    ttlMs: z.number().int().min(250).max(10000).optional(),
    color: z.string().min(1).optional()
  })
});

// Actors control (client -> host)
const lobbyActorsHpAddRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('actors:hpAdd:request'),
  body: z.object({ actorId: z.string().min(1), delta: z.number().int().min(-20).max(20) })
});

const lobbyActorsInventoryTransferRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('actors:inventory:transfer:request'),
  body: z.object({ fromId: z.string().min(1), toId: z.string().min(1), key: z.string().min(1), count: z.number().int().min(1).max(99).optional() })
});

const lobbyActorsEquipRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('actors:equip:request'),
  body: z.object({ actorId: z.string().min(1), key: z.string().min(1) })
});

const lobbyActorsUnequipRequestSchema = lobbyEnvelopeSchema.extend({
  kind: z.literal('actors:unequip:request'),
  body: z.object({ actorId: z.string().min(1), key: z.string().min(1) })
});

export const lobbyMessageSchema = z.discriminatedUnion('kind', [
  lobbyHelloSchema,
  lobbyStateSchema,
  lobbyReadySchema,
  lobbyLeaveSchema,
  lobbyChatSchema,
  lobbyCharacterSnapshotSchema,
  lobbyCharacterSetSchema,
  lobbyCharacterResetSchema,
  lobbyCharacterRequestSchema,
  lobbyLlmProgressSchema,
  lobbyMissionStartSchema,
  lobbyLlmConfigSchema,
  lobbyObjectPatchSchema,
  lobbyObjectReplaceSchema,
  lobbyObjectRequestSchema,
  lobbyObjectAckSchema,
  lobbyChatAppendRequestSchema,
  lobbyFieldMoveRequestSchema,
  lobbyMapTravelProposeSchema,
  lobbyMapTravelVoteSchema,
  lobbyMapTravelUpdateSchema,
  lobbyMapTravelCancelSchema,
  lobbyMapTravelRequestSchema,
  lobbyInteractInviteSchema,
  lobbyInteractAcceptSchema,
  lobbyInteractCancelSchema,
  lobbyInteractConfirmedSchema,
  lobbyMapPingSchema,
  lobbyActorsHpAddRequestSchema,
  lobbyActorsInventoryTransferRequestSchema,
  lobbyActorsEquipRequestSchema,
  lobbyActorsUnequipRequestSchema
]);

export type LobbyMessage = z.infer<typeof lobbyMessageSchema>;
export type LobbyMessageKind = LobbyMessage['kind'];

export type LobbyMessageBodies = {
  hello: { participant: LobbyParticipant };
  state: { participants: LobbyParticipant[] };
  ready: { participantId: string; ready: boolean };
  leave: { participantId: string };
  chat: { entry: LobbyChatMessage };
  'character:snapshot': { revision: number; loadouts: LobbyCharacterLoadout[] };
  'character:set': { playerId: string; loadout: LobbyCharacterLoadout };
  'character:reset': { playerId: string };
  'character:request': { sinceRevision?: number };
  'llm:progress': { ready?: boolean; progress?: number | null; status?: string | null; error?: string | null };
  'mission:start': Record<string, never>;
  'llm:config': { modelId: string; backend: 'gpu' | 'cpu' };
  'object:patch': { id: string; rev: number; ops: { op: 'set' | 'merge' | 'insert' | 'remove'; path?: string; value?: unknown }[] };
  'object:replace': { id: string; rev: number; value: unknown };
  'object:request': { id: string; sinceRev?: number };
  'object:ack': { id: string; rev: number };
  'chat:append:request': { body: string; authorId: string };
  'field:move:request': { playerId: string; mapId: string; fromFieldId: string; toFieldId: string };
  'map:travel:request': { requesterId: string; direction?: 'next' | 'prev'; toMapId?: string };
  'map:travel:propose': { requesterId: string; direction?: 'next' | 'prev'; toMapId?: string; quorum?: 'majority' | 'all' };
  'map:travel:vote': { inviteId: string; voterId: string; approve: boolean };
  'map:travel:update': { inviteId: string; status: 'proposed' | 'approved' | 'rejected' | 'cancelled'; targetMapId: string; yes: number; no: number; total: number; quorum: 'majority' | 'all' };
  'map:travel:cancel': { inviteId: string; byId: string };
  'interact:invite': { inviteId: string; fromId: string; toId: string; verb: string; mapId: string; fieldId: string };
  'interact:accept': { inviteId: string; toId: string };
  'interact:cancel': { inviteId: string; byId: string };
  'interact:confirmed': { inviteId: string; fromId: string; toId: string; verb: string };
  'map:ping': { byId: string; x: number; y: number; at?: number; ttlMs?: number; color?: string };
  'actors:hpAdd:request': { actorId: string; delta: number };
  'actors:inventory:transfer:request': { fromId: string; toId: string; key: string; count?: number };
  'actors:equip:request': { actorId: string; key: string };
  'actors:unequip:request': { actorId: string; key: string };
};

// =====================
// Auth & Logs (HTTP API)
// =====================

export const authSigninRequestSchema = z
  .object({ credential: z.string().min(10) })
  .strict();
export type AuthSigninRequest = z.infer<typeof authSigninRequestSchema>;

export const authUserSchema = z
  .object({
    sub: z.string().min(1),
    name: z.string().optional(),
    email: z.string().email().optional(),
    picture: z.string().url().optional(),
    iss: z.string().optional(),
    aud: z.string().optional(),
    exp: z.number().int().optional(),
    role: z.string().optional()
  })
  .strict();
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSigninResponseSchema = z
  .object({ ok: z.literal(true), user: authUserSchema, token: z.string().optional() })
  .strict();
export type AuthSigninResponse = z.infer<typeof authSigninResponseSchema>;

export const authMeResponseSchema = z
  .object({ ok: z.literal(true), user: authUserSchema, token: z.string().optional() })
  .strict();
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1)
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const llmLogCreateSchema = z
  .object({
    request_id: z.string().min(1),
    request_type: z.string().min(1),
    messages: z.array(chatMessageSchema).min(2),
    client_at: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    seed: z.number().optional(),
    meta: z.any().optional()
  })
  .strict();
export type LlmLogCreate = z.infer<typeof llmLogCreateSchema>;

export const llmLogCreateBatchSchema = z.union([llmLogCreateSchema, z.array(llmLogCreateSchema)]);
export type LlmLogCreateBatch = z.infer<typeof llmLogCreateBatchSchema>;

// Common query helpers
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Types query: GET /api/types?date=YYYY-MM-DD
export const typesQuerySchema = z
  .object({
    date: isoDateSchema
  })
  .strict();
export type TypesQuery = z.infer<typeof typesQuerySchema>;

// Logs list: GET /api/llm/logs?date=...&request_type=...&q=...&page=...&page_size=...
export const logsListQuerySchema = z
  .object({
    date: isoDateSchema,
    request_type: z.string().min(1),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(500).optional()
  })
  .strict();
export type LogsListQuery = z.infer<typeof logsListQuerySchema>;

// Logs by id: GET /api/llm/logs/{id}?date=...&request_type=...
export const logsReadByIdQuerySchema = z
  .object({
    date: isoDateSchema,
    request_type: z.string().min(1)
  })
  .strict();
export type LogsReadByIdQuery = z.infer<typeof logsReadByIdQuerySchema>;

// Download: GET /api/download?date=...&request_type=...&format=...&latest=1|0&filter=...&id?&max_turns?
export const downloadQuerySchema = z
  .object({
    date: isoDateSchema,
    request_type: z.string().min(1),
    format: z.enum(['ndjson', 'json', 'train-jsonl']).default('ndjson'),
    latest: z.union([z.literal('1'), z.literal('0')]).optional(),
    filter: z.enum(['complete', 'all']).optional(),
    id: z.string().optional(),
    max_turns: z.coerce.number().int().min(1).max(32).optional()
  })
  .strict();
export type DownloadQuery = z.infer<typeof downloadQuerySchema>;

// Update (PATCH): optional date/request_type to preserve current fallback semantics
export const logsUpdateQuerySchema = z
  .object({
    date: isoDateSchema.optional(),
    request_type: z.string().min(1).optional()
  })
  .strict();
export type LogsUpdateQuery = z.infer<typeof logsUpdateQuerySchema>;

// Delete (DELETE): optional date/request_type with same fallback semantics
export const logsDeleteQuerySchema = z
  .object({
    date: isoDateSchema.optional(),
    request_type: z.string().min(1).optional()
  })
  .strict();
export type LogsDeleteQuery = z.infer<typeof logsDeleteQuerySchema>;

// Update body: require messages as canonical container; allow passthrough fields
export const llmLogUpdateBodySchema = z
  .object({ messages: z.array(chatMessageSchema).min(2) })
  .passthrough();
export type LlmLogUpdateBody = z.infer<typeof llmLogUpdateBodySchema>;

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

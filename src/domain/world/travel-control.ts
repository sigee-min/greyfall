import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { travelSync } from './travel-session.js';
import { getHostObject } from '../net-objects/registry.js';
import { PARTY_OBJECT_ID } from '../net-objects/party-host.js';
import type { HostObject } from '../net-objects/types.js';
import { SlidingWindowLimiter } from '../net-objects/rate-limit.js';

type VoidState = null;

type PartyHostApi = HostObject & {
  getMembers: () => string[];
  travel: (direction?: 'next' | 'prev', toMapId?: string) => boolean;
};

function newId(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && 'randomUUID' in c) return (c as Crypto & { randomUUID: () => string }).randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const proposeLimiter = new SlidingWindowLimiter(4, 10_000);
const voteLimiter = new SlidingWindowLimiter(16, 10_000);

const control = defineSyncModel<VoidState>({
  id: 'world:travel:control',
  initial: () => null,
  requestOnStart: false,
  commands: [
    {
      kind: 'map:travel:propose',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { requesterId, direction, toMapId, quorum } = body as Partial<{
          requesterId: string;
          direction: 'next' | 'prev';
          toMapId: string;
          quorum: 'majority' | 'all';
        }>;
        if (typeof requesterId !== 'string') return null;
        if (!direction && !toMapId) return null;
        const q: 'majority' | 'all' = quorum === 'all' ? 'all' : 'majority';
        return { requesterId, direction, toMapId, quorum: q };
      },
      handle: ({ payload }) => {
        const { requesterId, toMapId, quorum } = payload as {
          requesterId: string;
          toMapId?: string;
          quorum: 'majority' | 'all';
        };
        if (!proposeLimiter.allow(`propose:${requesterId}`)) return;
        const party = getHostObject<PartyHostApi>(PARTY_OBJECT_ID);
        if (!party) return;
        const members = party.getMembers();
        if (members.length === 0) return;
        const target = toMapId ?? null;
        const inviteId = newId();
        travelSync.host.set({ inviteId, targetMapId: target, status: 'proposed', quorum, total: members.length, yes: 0, no: 0 }, 'travel:propose');
      }
    },
    {
      kind: 'map:travel:vote',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { inviteId, voterId, approve } = body as { inviteId?: unknown; voterId?: unknown; approve?: unknown };
        if (typeof inviteId !== 'string' || typeof voterId !== 'string' || typeof approve !== 'boolean') return null;
        return { inviteId, voterId, approve };
      },
      handle: ({ payload }) => {
        const { inviteId, voterId, approve } = payload as { inviteId: string; voterId: string; approve: boolean };
        if (!voteLimiter.allow(`vote:${voterId}`)) return;
        const current = travelSync.host.get();
        if (current.inviteId !== inviteId || current.status !== 'proposed') return;
        const party = getHostObject<PartyHostApi>(PARTY_OBJECT_ID);
        if (!party) return;
        const members = party.getMembers();
        const eligible = new Set(members);
        if (!eligible.has(voterId)) return;
        // recompute yes/no counts by tracking voter set in memory — use snapshot fields as counters
        const yes = current.yes + (approve ? 1 : 0);
        const no = current.no + (!approve ? 1 : 0);
        const total = current.total;
        let status: 'proposed' | 'approved' | 'rejected' = 'proposed';
        if (current.quorum === 'all') {
          if (yes + no >= total) status = yes === total ? 'approved' : 'rejected';
        } else {
          if (yes > Math.floor(total / 2)) status = 'approved';
          else if (no >= Math.ceil(total / 2)) status = 'rejected';
        }
        travelSync.host.set({ ...current, yes, no, status }, 'travel:vote');
        if (status === 'approved') {
          const target = current.targetMapId ?? undefined;
          party.travel(undefined, target);
        }
      }
    },
    {
      kind: 'map:travel:cancel',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { inviteId, byId } = body as { inviteId?: unknown; byId?: unknown };
        if (typeof inviteId !== 'string' || typeof byId !== 'string') return null;
        return { inviteId, byId };
      },
      authorize: ({ payload, lobbyStore }) => {
        const host = lobbyStore.participantsRef.current.find((p) => p.role === 'host');
        return !!host && host.id === (payload as { byId: string }).byId;
      },
      handle: ({ payload }) => {
        const { inviteId } = payload as { inviteId: string; byId: string };
        const current = travelSync.host.get();
        if (current.inviteId !== inviteId) return;
        travelSync.host.set({ ...current, status: 'cancelled' }, 'travel:cancel');
      }
    }
  ]
});

registerSyncModel(control);

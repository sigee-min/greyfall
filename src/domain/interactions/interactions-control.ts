import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { interactionsSync, type Invite } from './interactions-session.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_POSITIONS_OBJECT_ID } from '../net-objects/world-positions-host.js';
import type { HostObject } from '../net-objects/types.js';

type VoidState = null;

type Position = { id: string; mapId: string; fieldId: string };

// Track per-invite TTL timers on host
const inviteTimers = new Map<string, ReturnType<typeof setTimeout>>();

const control = defineSyncModel<VoidState>({
  id: 'interact:control',
  initial: () => null,
  requestOnStart: false,
  commands: [
    {
      kind: 'interact:invite',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { inviteId, fromId, toId, mapId, fieldId, verb } = body as Partial<Invite>;
        if (!inviteId || !fromId || !toId || !mapId || !fieldId || !verb) return null;
        return { inviteId: String(inviteId), fromId: String(fromId), toId: String(toId), mapId: String(mapId), fieldId: String(fieldId), verb: String(verb), status: 'pending' as const };
      },
      handle: ({ payload, context }) => {
        const invite = payload as Invite;
        // Validate that both users exist and are on the same map/field
        const okParticipants = [invite.fromId, invite.toId].every((id) => context.lobbyStore.participantsRef.current.some((p) => p.id === id));
        if (!okParticipants) return;
        const world = getHostObject<HostObject>(WORLD_POSITIONS_OBJECT_ID) as unknown as { replicator?: { get?: (id: string) => { value?: unknown } } } | null;
        const posState = world?.replicator?.get?.('world:positions')?.value as unknown;
        const list: Position[] = Array.isArray((posState as { list?: Position[] } | null | undefined)?.list)
          ? ((posState as { list: Position[] }).list)
          : [];
        const pf = list.find((e) => e.id === invite.fromId);
        const pt = list.find((e) => e.id === invite.toId);
        if (!pf || !pt) return;
        if (!(pf.mapId === invite.mapId && pt.mapId === invite.mapId && pf.fieldId === invite.fieldId && pt.fieldId === invite.fieldId)) {
          console.warn('[interact] invite rejected: not same field');
          return;
        }
        interactionsSync.host.update((state) => {
          const next = state.invites.filter((i) => i.inviteId !== invite.inviteId);
          next.push({ ...invite, expiresAt: Date.now() + 60_000 });
          return { invites: next };
        }, 'interact:invite');
        // Schedule auto-cancel after TTL if still pending
        try {
          if (inviteTimers.has(invite.inviteId)) {
            clearTimeout(inviteTimers.get(invite.inviteId)!);
            inviteTimers.delete(invite.inviteId);
          }
          const timer = setTimeout(() => {
            interactionsSync.host.update((state) => {
              const idx = state.invites.findIndex((i) => i.inviteId === invite.inviteId && i.status === 'pending');
              if (idx < 0) return state;
              const next = state.invites.slice();
              next[idx] = { ...next[idx], status: 'cancelled', expiresAt: null };
              return { invites: next };
            }, 'interact:timeout');
            inviteTimers.delete(invite.inviteId);
          }, 60_000);
          inviteTimers.set(invite.inviteId, timer);
        } catch {}
      }
    },
    {
      kind: 'interact:accept',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { inviteId, toId } = body as { inviteId?: unknown; toId?: unknown };
        if (typeof inviteId !== 'string' || typeof toId !== 'string') return null;
        return { inviteId, toId };
      },
      handle: ({ payload }) => {
        const { inviteId, toId } = payload as { inviteId: string; toId: string };
        interactionsSync.host.update((state) => {
          const idx = state.invites.findIndex((i) => i.inviteId === inviteId && i.toId === toId);
          if (idx < 0) return state;
          const next = state.invites.slice();
          next[idx] = { ...next[idx], status: 'confirmed', expiresAt: null };
          return { invites: next };
        }, 'interact:accept');
        const t = inviteTimers.get(inviteId);
        if (t) {
          clearTimeout(t);
          inviteTimers.delete(inviteId);
        }
      }
    },
    {
      kind: 'interact:cancel',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { inviteId, byId } = body as { inviteId?: unknown; byId?: unknown };
        if (typeof inviteId !== 'string' || typeof byId !== 'string') return null;
        return { inviteId, byId };
      },
      handle: ({ payload, context }) => {
        const { inviteId, byId } = payload as { inviteId: string; byId: string };
        // Optional: allow only host or participants to cancel; keeping it simple for now
        const allowed = context.lobbyStore.participantsRef.current.some((p) => p.id === byId) || context.lobbyStore.participantsRef.current.some((p) => p.role === 'host' && p.id === byId);
        if (!allowed) return;
        interactionsSync.host.update((state) => {
          const idx = state.invites.findIndex((i) => i.inviteId === inviteId);
          if (idx < 0) return state;
          const next = state.invites.slice();
          next[idx] = { ...next[idx], status: 'cancelled', expiresAt: null };
          return { invites: next };
        }, 'interact:cancel');
        const t = inviteTimers.get(inviteId);
        if (t) {
          clearTimeout(t);
          inviteTimers.delete(inviteId);
        }
      }
    }
  ]
});

registerSyncModel(control);

import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { interactionsSync } from './interactions-session.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_POSITIONS_OBJECT_ID, WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
// Track per-invite TTL timers on host
const inviteTimers = new Map();
const control = defineSyncModel({
    id: 'interact:control',
    initial: () => null,
    requestOnStart: false,
    commands: [
        {
            kind: 'interact:invite',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { inviteId, fromId, toId, mapId, fieldId, verb } = body;
                if (!inviteId || !fromId || !toId || !mapId || !fieldId || !verb)
                    return null;
                return { inviteId: String(inviteId), fromId: String(fromId), toId: String(toId), mapId: String(mapId), fieldId: String(fieldId), verb: String(verb), status: 'pending' };
            },
            handle: ({ payload, context }) => {
                const invite = payload;
                // Validate that both users exist and are on the same map/field
                const okParticipants = [invite.fromId, invite.toId].every((id) => context.lobbyStore.participantsRef.current.some((p) => p.id === id));
                if (!okParticipants)
                    return;
                const world = getHostObject(WORLD_POSITIONS_OBJECT_ID);
                const list = world ? world.getList() : [];
                const pf = list.find((e) => e.id === invite.fromId);
                const pt = list.find((e) => e.id === invite.toId);
                if (!pf || !pt)
                    return;
                if (!(pf.mapId === invite.mapId && pt.mapId === invite.mapId && pf.fieldId === invite.fieldId && pt.fieldId === invite.fieldId)) {
                    console.warn('[interact] invite rejected: not same field');
                    return;
                }
                interactionsSync.host.update((state) => {
                    const next = state.invites.filter((i) => i.inviteId !== invite.inviteId);
                    next.push({ ...invite, expiresAt: Date.now() + 60000 });
                    return { invites: next };
                }, 'interact:invite');
                // Schedule auto-cancel after TTL if still pending
                try {
                    if (inviteTimers.has(invite.inviteId)) {
                        clearTimeout(inviteTimers.get(invite.inviteId));
                        inviteTimers.delete(invite.inviteId);
                    }
                    const timer = setTimeout(() => {
                        interactionsSync.host.update((state) => {
                            const idx = state.invites.findIndex((i) => i.inviteId === invite.inviteId && i.status === 'pending');
                            if (idx < 0)
                                return state;
                            const next = state.invites.slice();
                            next[idx] = { ...next[idx], status: 'cancelled', expiresAt: null };
                            return { invites: next };
                        }, 'interact:timeout');
                        inviteTimers.delete(invite.inviteId);
                    }, 60000);
                    inviteTimers.set(invite.inviteId, timer);
                }
                catch { }
            }
        },
        {
            kind: 'interact:accept',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { inviteId, toId } = body;
                if (typeof inviteId !== 'string' || typeof toId !== 'string')
                    return null;
                return { inviteId, toId };
            },
            handle: ({ payload }) => {
                const { inviteId, toId } = payload;
                // Capture the accepted invite for side-effects after state update
                let accepted = null;
                interactionsSync.host.update((state) => {
                    const idx = state.invites.findIndex((i) => i.inviteId === inviteId && i.toId === toId);
                    if (idx < 0)
                        return state;
                    const next = state.invites.slice();
                    next[idx] = { ...next[idx], status: 'confirmed', expiresAt: null };
                    const acc = next[idx];
                    accepted = { fromId: String(acc.fromId), toId: String(acc.toId), verb: String(acc.verb) };
                    return { invites: next };
                }, 'interact:accept');
                const t = inviteTimers.get(inviteId);
                if (t) {
                    clearTimeout(t);
                    inviteTimers.delete(inviteId);
                }
                // Apply minimal semantics for common verbs after acceptance.
                try {
                    const a = accepted;
                    if (!a)
                        return;
                    const actors = getHostObject(WORLD_ACTORS_OBJECT_ID);
                    // Ensure both actors exist
                    actors?.ensure(a.fromId);
                    actors?.ensure(a.toId);
                    if (a.verb === 'assist') {
                        // Simple assist: heal target for +3 HP
                        actors?.hpAdd(a.toId, 3);
                    }
                    else if (a.verb === 'trade') {
                        // Simple trade: transfer first available item
                        actors?.transferFirstAvailableItem(a.fromId, a.toId);
                    }
                }
                catch (e) {
                    // best-effort; avoid throwing from control plane
                    console.warn('[interact] effect apply failed', e);
                }
            }
        },
        {
            kind: 'interact:cancel',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { inviteId, byId } = body;
                if (typeof inviteId !== 'string' || typeof byId !== 'string')
                    return null;
                return { inviteId, byId };
            },
            handle: ({ payload, context }) => {
                const { inviteId, byId } = payload;
                // Optional: allow only host or participants to cancel; keeping it simple for now
                const allowed = context.lobbyStore.participantsRef.current.some((p) => p.id === byId) || context.lobbyStore.participantsRef.current.some((p) => p.role === 'host' && p.id === byId);
                if (!allowed)
                    return;
                interactionsSync.host.update((state) => {
                    const idx = state.invites.findIndex((i) => i.inviteId === inviteId);
                    if (idx < 0)
                        return state;
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

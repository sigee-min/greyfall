import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { travelSync } from './travel-session.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_POSITIONS_OBJECT_ID, PARTY_OBJECT_ID } from '../net-objects/object-ids.js';
import { getMap, getEntryField } from '../world/nav';
import { getLimiter } from '../net-objects/policies.js';
function newId() {
    try {
        const c = globalThis.crypto;
        if (c && 'randomUUID' in c)
            return c.randomUUID();
    }
    catch { }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
const proposeLimiter = getLimiter('travel:propose');
const voteLimiter = getLimiter('travel:vote');
const control = defineSyncModel({
    id: 'world:travel:control',
    initial: () => null,
    requestOnStart: false,
    commands: [
        {
            kind: 'map:travel:propose',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { requesterId, direction, toMapId, quorum } = body;
                if (typeof requesterId !== 'string')
                    return null;
                if (!direction && !toMapId)
                    return null;
                const q = quorum === 'all' ? 'all' : 'majority';
                return { requesterId, direction, toMapId, quorum: q };
            },
            handle: ({ payload }) => {
                const { requesterId, direction, toMapId, quorum } = payload;
                if (!proposeLimiter.allow(`propose:${requesterId}`))
                    return;
                const party = getHostObject(PARTY_OBJECT_ID);
                if (!party)
                    return;
                const members = party.getMembers();
                if (members.length === 0)
                    return;
                // Precondition: all members at entry field of current map
                const world = getHostObject(WORLD_POSITIONS_OBJECT_ID);
                const list = world ? world.getList() : [];
                const first = list.find((e) => e.id === members[0]);
                if (!first)
                    return;
                const map = getMap(first.mapId);
                if (!map)
                    return;
                const entry = getEntryField(map);
                const allOnSameMap = members.every((m) => {
                    const p = list.find((e) => e.id === m);
                    return p && p.mapId === first.mapId && p.fieldId === (entry?.id ?? '');
                });
                if (!allOnSameMap) {
                    console.warn('[travel] denied: not all at entry', { firstMap: first.mapId });
                    return;
                }
                // Resolve target from toMapId or direction
                let target = toMapId ?? '';
                if (!target && direction) {
                    target = direction === 'next' ? (map.next ?? map.id) : (map.prev ?? map.id);
                }
                if (!target || target === map.id)
                    return;
                const inviteId = newId();
                travelSync.host.set({ inviteId, targetMapId: target, status: 'proposed', quorum, total: members.length, yes: 0, no: 0, deadlineAt: Date.now() + 60000 }, 'travel:propose');
            }
        },
        {
            kind: 'map:travel:vote',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { inviteId, voterId, approve } = body;
                if (typeof inviteId !== 'string' || typeof voterId !== 'string' || typeof approve !== 'boolean')
                    return null;
                return { inviteId, voterId, approve };
            },
            handle: ({ payload }) => {
                const { inviteId, voterId, approve } = payload;
                if (!voteLimiter.allow(`vote:${voterId}`))
                    return;
                const current = travelSync.host.get();
                if (current.inviteId !== inviteId || current.status !== 'proposed')
                    return;
                const party = getHostObject(PARTY_OBJECT_ID);
                if (!party)
                    return;
                const members = party.getMembers();
                const eligible = new Set(members);
                if (!eligible.has(voterId))
                    return;
                // recompute yes/no counts by tracking voter set in memory — use snapshot fields as counters
                const yes = current.yes + (approve ? 1 : 0);
                const no = current.no + (!approve ? 1 : 0);
                const total = current.total;
                let status = 'proposed';
                if (current.quorum === 'all') {
                    if (yes + no >= total)
                        status = yes === total ? 'approved' : 'rejected';
                }
                else {
                    if (yes > Math.floor(total / 2))
                        status = 'approved';
                    else if (no >= Math.ceil(total / 2))
                        status = 'rejected';
                }
                travelSync.host.set({ ...current, yes, no, status, deadlineAt: status === 'proposed' ? current.deadlineAt : null }, 'travel:vote');
                if (status === 'approved') {
                    const target = current.targetMapId ?? undefined;
                    party.travel(undefined, target);
                }
            }
        },
        {
            kind: 'map:travel:cancel',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { inviteId, byId } = body;
                if (typeof inviteId !== 'string' || typeof byId !== 'string')
                    return null;
                return { inviteId, byId };
            },
            authorize: ({ payload, lobbyStore }) => {
                const host = lobbyStore.participantsRef.current.find((p) => p.role === 'host');
                return !!host && host.id === payload.byId;
            },
            handle: ({ payload }) => {
                const { inviteId } = payload;
                const current = travelSync.host.get();
                if (current.inviteId !== inviteId)
                    return;
                travelSync.host.set({ ...current, status: 'cancelled', deadlineAt: null }, 'travel:cancel');
            }
        }
    ]
});
registerSyncModel(control);

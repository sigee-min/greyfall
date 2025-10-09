import type { HostObject, CommonDeps } from './types';
import { HostValueObject } from './base/value-object.js';
import { getMap } from '../world/nav';
import { HostWorldPositionsObject } from './world-positions-host';
import { PARTY_OBJECT_ID, WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';
import { registerNetObject, HostAckFallback } from './registry.js';

export { PARTY_OBJECT_ID } from './object-ids.js';

export class HostPartyObject implements HostObject {
  readonly id = PARTY_OBJECT_ID;
  private readonly value: HostValueObject<{ mapId: string; members: string[] }>;
  constructor(private deps: CommonDeps, private world: HostWorldPositionsObject) {
    this.value = new HostValueObject<{ mapId: string; members: string[] }>(deps, this.id, { mapId: 'LUMENFORD', members: [] }, 'party:init');
  }

  onRequest(sinceRev?: number) {
    return this.value.onRequest(sinceRev);
  }

  addMember(id: string) {
    const base = this.value.getSnapshot()?.value as any;
    const members: string[] = Array.isArray(base?.members) ? base.members : [];
    if (members.includes(id)) return true;
    return this.value.merge({ members: [...members, id] }, 'party:join');
  }

  removeMember(id: string) {
    const base = this.value.getSnapshot()?.value as any;
    const members: string[] = Array.isArray(base?.members) ? base.members : [];
    if (!members.includes(id)) return true;
    const filtered = members.filter((m) => m !== id);
    return this.value.set({ mapId: base?.mapId ?? 'LUMENFORD', members: filtered }, 'party:leave');
  }

  getMapId(): string {
    const base = this.value.getSnapshot()?.value as any;
    return String(base?.mapId ?? 'LUMENFORD');
  }

  getMembers(): string[] {
    const base = this.value.getSnapshot()?.value as any;
    const members: string[] = Array.isArray(base?.members) ? base.members : [];
    return members;
  }

  travel(direction?: 'next' | 'prev', toMapId?: string) {
    const base = this.value.getSnapshot()?.value as any;
    const currentId: string = String(base?.mapId ?? 'LUMENFORD');
    let targetId = toMapId ?? currentId;
    if (direction) {
      const m = getMap(currentId);
      if (!m) return false;
      targetId = direction === 'next' ? (m.next ?? currentId) : (m.prev ?? currentId);
    }
    if (targetId === currentId) return true;
    const members = this.getMembers();
    const ok = this.world.movePartyToMap(targetId, members);
    if (!ok) return false;
    return this.value.merge({ mapId: targetId }, 'party:travel');
  }
}

registerNetObject({
  id: PARTY_OBJECT_ID,
  host: {
    create: (deps, ctx) => {
      const world = ctx.get<HostWorldPositionsObject>(WORLD_POSITIONS_OBJECT_ID);
      if (!world) {
        throw new Error('HostPartyObject requires world positions object');
      }
      return new HostPartyObject(deps, world);
    },
    ack: {
      incrementalMax: 16,
      fallbackStrategy: HostAckFallback.Snapshot
    },
    onPeerConnect: (object) => {
      object.onRequest(undefined);
    }
  },
  client: {
    requestOnStart: true,
    requestContext: 'request party'
  }
});

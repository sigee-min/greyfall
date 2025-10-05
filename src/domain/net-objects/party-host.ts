import type { HostObject, CommonDeps } from './types';
import { HostReplicator } from './replicator';
import { getMap } from '../world/nav';
import { HostWorldPositionsObject } from './world-positions-host';

export const PARTY_OBJECT_ID = 'party';

export class HostPartyObject implements HostObject {
  readonly id = PARTY_OBJECT_ID;
  private readonly replicator: HostReplicator;
  constructor(private deps: CommonDeps, private world: HostWorldPositionsObject) {
    this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind as any, body as any, ctx));
    // initialize with default map and empty members
    this.replicator.set(this.id, { mapId: 'LUMENFORD', members: [] }, 'party:init');
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, 'object-request party');
  }

  addMember(id: string) {
    const base = this.replicator.get(this.id)?.value as any;
    const members: string[] = Array.isArray(base?.members) ? base.members : [];
    if (members.includes(id)) return true;
    return this.replicator.apply(this.id, [{ op: 'merge', path: 'members', value: [id] } as any], 'party:join');
  }

  removeMember(id: string) {
    const base = this.replicator.get(this.id)?.value as any;
    const members: string[] = Array.isArray(base?.members) ? base.members : [];
    if (!members.includes(id)) return true;
    const filtered = members.filter((m) => m !== id);
    return this.replicator.set(this.id, { mapId: base?.mapId ?? 'LUMENFORD', members: filtered }, 'party:leave');
  }

  getMapId(): string {
    const base = this.replicator.get(this.id)?.value as any;
    return String(base?.mapId ?? 'LUMENFORD');
  }

  getMembers(): string[] {
    const base = this.replicator.get(this.id)?.value as any;
    const members: string[] = Array.isArray(base?.members) ? base.members : [];
    return members;
  }

  travel(direction?: 'next' | 'prev', toMapId?: string) {
    const base = this.replicator.get(this.id)?.value as any;
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
    return this.replicator.apply(this.id, [{ op: 'merge', value: { mapId: targetId } } as any], 'party:travel');
  }
}


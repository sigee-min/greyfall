import { HostReplicator } from '../replicator';
export class HostValueObject {
    constructor(deps, id, initial, context = 'value:init') {
        this.deps = deps;
        this.id = id;
        this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind, body, ctx), 256, 64);
        if (initial !== undefined) {
            this.replicator.set(this.id, initial, context);
        }
    }
    set(value, context = 'value:set') {
        return this.replicator.set(this.id, value, context);
    }
    merge(partial, context = 'value:merge') {
        const op = { op: 'merge', value: partial };
        return this.replicator.apply(this.id, [op], context);
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
    }
    getSnapshot() { return this.replicator.get(this.id); }
    getLogsSince(sinceRev) { return this.replicator.getLogsSince(this.id, sinceRev); }
}

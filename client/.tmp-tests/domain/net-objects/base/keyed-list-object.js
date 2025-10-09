import { HostReplicator } from '../replicator';
export class HostKeyedListObject {
    constructor(deps, id, options) {
        this.deps = deps;
        this.id = id;
        this.path = options?.path ?? 'list';
        this.replicator = new HostReplicator((kind, body, context) => deps.publish(kind, body, context), 512, 64);
        const initial = Array.isArray(options?.initial) ? options.initial : [];
        const payload = { [this.path]: initial };
        this.replicator.set(this.id, payload, options?.context ?? 'keyed-list:init');
    }
    upsertMany(entries, context = 'keyed-list:upsert') {
        const op = { op: 'merge', path: this.path, value: entries };
        return this.replicator.apply(this.id, [op], context);
    }
    removeById(id, context = 'keyed-list:remove') {
        const op = { op: 'remove', path: this.path, value: { id } };
        return this.replicator.apply(this.id, [op], context);
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
    }
    getSnapshot() { return this.replicator.get(this.id); }
    getLogsSince(sinceRev) { return this.replicator.getLogsSince(this.id, sinceRev); }
}

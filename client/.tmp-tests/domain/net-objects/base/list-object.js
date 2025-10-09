import { HostReplicator } from '../replicator';
export class HostListObject {
    constructor(deps, id, options) {
        this.deps = deps;
        this.id = id;
        this.path = options?.path ?? 'entries';
        this.max = options?.max ?? 256;
        this.replicator = new HostReplicator((kind, body, context) => deps.publish(kind, body, context), 512, 64);
        const initial = Array.isArray(options?.initial) ? options.initial : [];
        const payload = { [this.path]: initial };
        this.replicator.set(this.id, payload, options?.context ?? 'list:init');
    }
    append(item, context = 'list:append') {
        const snapshot = this.replicator.get(this.id)?.value;
        const container = isRecord(snapshot) ? snapshot[this.path] : undefined;
        const list = Array.isArray(container) ? [...container] : [];
        list.push(item);
        while (list.length > this.max)
            list.shift();
        // First change after init might be rev=1 already; replicator handles set/patch logging.
        if ((this.replicator.get(this.id)?.rev ?? 0) === 0) {
            const payload = { [this.path]: list };
            return this.replicator.set(this.id, payload, context);
        }
        const op = { op: 'insert', path: this.path, value: item };
        return this.replicator.apply(this.id, [op], context);
    }
    replaceAll(items, context = 'list:replace') {
        const payload = { [this.path]: [...items] };
        return this.replicator.set(this.id, payload, context);
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
    }
    getSnapshot() { return this.replicator.get(this.id); }
    getLogsSince(sinceRev) { return this.replicator.getLogsSince(this.id, sinceRev); }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

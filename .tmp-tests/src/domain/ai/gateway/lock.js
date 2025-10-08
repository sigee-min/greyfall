// Per-manager FIFO lock to prevent concurrent generations on the same engine
const inflightByManager = new Map();
export async function runWithManagerLock(manager, task) {
    if (!inflightByManager.has(manager)) {
        inflightByManager.set(manager, Promise.resolve());
    }
    const prev = inflightByManager.get(manager);
    let release = () => { };
    const gate = new Promise((r) => (release = r));
    inflightByManager.set(manager, prev.then(() => gate));
    try {
        await prev;
    }
    catch {
        // Prior failure does not block the queue
    }
    try {
        const result = await task();
        release();
        return result;
    }
    catch (err) {
        release();
        throw err;
    }
}

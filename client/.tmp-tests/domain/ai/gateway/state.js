const firstGenDoneByManager = new Map();
export function isFirstGen(manager) {
    return !firstGenDoneByManager.get(manager);
}
export function markFirstGenDone(manager) {
    firstGenDoneByManager.set(manager, true);
}

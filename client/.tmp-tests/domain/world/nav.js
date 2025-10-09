import { WORLD_STATIC } from './data';
export function getMap(mapId) {
    return WORLD_STATIC.maps.find((m) => m.id === mapId) ?? null;
}
export function getField(map, fieldId) {
    return map.fields.find((f) => f.id === fieldId) ?? null;
}
export function isNeighbor(map, fromFieldId, toFieldId) {
    const from = getField(map, fromFieldId);
    if (!from)
        return false;
    return from.neighbors.includes(toFieldId);
}
export function getEntryField(map) {
    return getField(map, map.entryFieldId);
}

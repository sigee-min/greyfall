export function resolveFieldBackground(map, field) {
    return field.bg ?? map.bg;
}
export function resolveFieldMusic(map, field) {
    return field.musicCue ?? map.music;
}

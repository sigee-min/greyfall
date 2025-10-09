import { useEffect, useState } from 'react';
import { WORLD_STATIC } from './data';
import { resolveFieldBackground, resolveFieldMusic } from './resolvers';
import { worldPositionsClient } from '../net-objects/world-positions-client';
function preferWav(paths) {
    const out = [];
    for (const p of paths) {
        const wav = p.replace(/\.(ogg|mp3|wav)$/i, '.wav');
        if (!out.includes(wav))
            out.push(wav);
        if (!out.includes(p))
            out.push(p);
    }
    return out;
}
export function useWorldMedia(localParticipantId) {
    const [, bumpVersion] = useState(0);
    useEffect(() => worldPositionsClient.subscribe(() => bumpVersion((v) => v + 1)), []);
    const pos = localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null;
    const map = WORLD_STATIC.maps.find((m) => m.id === (pos?.mapId ?? WORLD_STATIC.head)) ?? WORLD_STATIC.maps[0];
    const fieldId = pos?.fieldId ?? map.entryFieldId;
    const field = map.fields.find((f) => f.id === fieldId) ?? map.fields[0];
    const bg = resolveFieldBackground(map, field);
    const music = resolveFieldMusic(map, field);
    const tracks = preferWav(Array.isArray(music.tracks) ? music.tracks : [music.tracks]);
    const media = { bgSrc: bg.path, tracks };
    return media;
}

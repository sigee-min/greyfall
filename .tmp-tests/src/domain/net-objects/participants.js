export const PARTICIPANTS_OBJECT_ID = 'participants';
export function makeParticipantsSnapshot(list, max = 4) {
    return { list, max };
}
export function isParticipantsSnapshot(value) {
    if (!value || typeof value !== 'object')
        return false;
    const v = value;
    if (!Array.isArray(v.list))
        return false;
    if (typeof v.max !== 'number')
        return false;
    return true;
}

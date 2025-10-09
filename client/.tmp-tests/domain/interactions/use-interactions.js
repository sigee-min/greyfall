import { useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useInteractionsState } from './interactions-session';
// Invite type now comes from interactions-session
export function useInteractions(args) {
    const { localParticipantId, mapId, fieldId, publish } = args;
    const invites = useInteractionsState((s) => s.invites);
    const sendInvite = useCallback((toId, verb) => {
        const fromId = localParticipantId;
        if (!fromId)
            return false;
        const inviteId = nanoid(10);
        const body = { inviteId, fromId, toId, mapId, fieldId, verb };
        return publish('interact:invite', body, 'ui:interact:invite');
    }, [fieldId, localParticipantId, mapId, publish]);
    const acceptInvite = useCallback((inviteId) => {
        const toId = localParticipantId;
        if (!toId)
            return false;
        const body = { inviteId, toId };
        return publish('interact:accept', body, 'ui:interact:accept');
    }, [localParticipantId, publish]);
    const cancelInvite = useCallback((inviteId) => {
        const byId = localParticipantId;
        if (!byId)
            return false;
        const body = { inviteId, byId };
        return publish('interact:cancel', body, 'ui:interact:cancel');
    }, [localParticipantId, publish]);
    const incoming = useMemo(() => invites.filter((i) => i.toId === localParticipantId && i.status === 'pending'), [invites, localParticipantId]);
    const outgoing = useMemo(() => invites.filter((i) => i.fromId === localParticipantId && i.status === 'pending'), [invites, localParticipantId]);
    return { invites, incoming, outgoing, sendInvite, acceptInvite, cancelInvite };
}

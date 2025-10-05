import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export function useLobbyStore() {
    const [participants, setParticipants] = useState([]);
    const participantsRef = useRef(participants);
    const [localParticipantId, setLocalParticipantIdState] = useState(null);
    const localParticipantIdRef = useRef(null);
    useEffect(() => {
        participantsRef.current = participants;
    }, [participants]);
    const decorate = useCallback((list) => {
        const localId = localParticipantIdRef.current;
        return list.map((participant) => ({
            ...participant,
            isSelf: participant.id === localId
        }));
    }, []);
    const toWire = useCallback((participant) => ({
        id: participant.id,
        name: participant.name,
        tag: participant.tag,
        ready: participant.ready,
        role: participant.role
    }), []);
    const snapshotWire = useCallback(() => participantsRef.current.map(toWire), [toWire]);
    const replaceFromWire = useCallback((list) => {
        const decorated = decorate(list);
        participantsRef.current = decorated;
        setParticipants(decorated);
    }, [decorate]);
    const upsertFromWire = useCallback((participant) => {
        const base = participantsRef.current.filter((entry) => entry.id !== participant.id);
        replaceFromWire([...base.map(toWire), participant]);
    }, [replaceFromWire, toWire]);
    const remove = useCallback((participantId) => {
        const base = participantsRef.current.filter((entry) => entry.id !== participantId);
        replaceFromWire(base.map(toWire));
    }, [replaceFromWire, toWire]);
    const hostSnapshot = useCallback(() => {
        return participantsRef.current.filter((participant) => participant.role === 'host').map(toWire);
    }, [toWire]);
    const setLocalParticipantId = useCallback((id) => {
        localParticipantIdRef.current = id;
        setLocalParticipantIdState(id);
        replaceFromWire(participantsRef.current.map(toWire));
    }, [replaceFromWire, toWire]);
    return useMemo(() => ({
        participants,
        participantsRef,
        localParticipantId,
        localParticipantIdRef,
        setLocalParticipantId,
        replaceFromWire,
        upsertFromWire,
        remove,
        hostSnapshot,
        toWire,
        snapshotWire
    }), [
        hostSnapshot,
        localParticipantId,
        remove,
        participants,
        replaceFromWire,
        setLocalParticipantId,
        snapshotWire,
        toWire,
        upsertFromWire
    ]);
}

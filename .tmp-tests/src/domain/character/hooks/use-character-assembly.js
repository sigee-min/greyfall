import { useCallback, useMemo } from 'react';
import { useCharacterStore } from '../../../store/character';
function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}
export function useCharacterAssembly() {
    const roll = useCharacterStore((state) => state.roll);
    const budget = useCharacterStore((state) => state.budget);
    const remaining = useCharacterStore((state) => state.remaining);
    const stats = useCharacterStore((state) => state.stats);
    const passives = useCharacterStore((state) => state.passives);
    const traits = useCharacterStore((state) => state.traits);
    const built = useCharacterStore((state) => state.built);
    const setRolled = useCharacterStore((state) => state.setRolled);
    const selectTrait = useCharacterStore((state) => state.selectTrait);
    const deselectTrait = useCharacterStore((state) => state.deselectTrait);
    const finalize = useCharacterStore((state) => state.finalize);
    const hydrate = useCharacterStore((state) => state.hydrate);
    const reset = useCharacterStore((state) => state.reset);
    const ensureRoll = useCallback(() => {
        if (!roll) {
            setRolled([rollD6(), rollD6(), rollD6()]);
        }
    }, [roll, setRolled]);
    const addTrait = useCallback((trait) => {
        selectTrait(trait);
    }, [selectTrait]);
    const removeTrait = useCallback((traitId) => {
        deselectTrait(traitId);
    }, [deselectTrait]);
    const getSummary = useCallback(() => ({
        roll,
        stats,
        passives,
        traits,
        remaining,
        budget,
        built
    }), [built, budget, passives, remaining, roll, stats, traits]);
    const finalizeCharacter = useCallback((options) => {
        finalize();
        if (options?.publish && options.localParticipantId && options.body) {
            options.publish('chat:append:request', { body: options.body, authorId: options.localParticipantId }, options.context ?? 'character:finalized');
        }
    }, [finalize]);
    const hydrateFromSnapshot = useCallback((snapshot) => {
        hydrate({
            built: snapshot.built,
            roll: snapshot.roll,
            budget: snapshot.budget,
            remaining: snapshot.remaining,
            stats: snapshot.stats,
            passives: snapshot.passives,
            traits: snapshot.traits
        });
    }, [hydrate]);
    const clear = useCallback(() => {
        reset();
    }, [reset]);
    const summary = useMemo(() => ({
        roll,
        stats,
        passives,
        traits,
        remaining,
        budget,
        built
    }), [built, budget, passives, remaining, roll, stats, traits]);
    return {
        roll,
        budget,
        remaining,
        stats,
        passives,
        traits,
        built,
        ensureRoll,
        addTrait,
        removeTrait,
        finalizeCharacter,
        hydrateFromSnapshot,
        clear,
        getSummary,
        summary
    };
}

import { useCallback, useMemo } from 'react';
import { useCharacterStore, type TraitSpec, type Passive, type StatKey, type CharacterSnapshot } from '../../../store/character';
import type { LobbyMessageBodies, LobbyMessageKind } from '../../../protocol';
import type { CharacterLoadout } from '../types';

export type Publish = <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context?: string) => boolean;

export type CharacterSummary = {
  stats: Record<StatKey, number>;
  passives: Passive[];
  traits: TraitSpec[];
  remaining: number;
  budget: number;
  built: boolean;
};

export function useCharacterAssembly() {
  const budget = useCharacterStore((state) => state.budget);
  const remaining = useCharacterStore((state) => state.remaining);
  const stats = useCharacterStore((state) => state.stats);
  const passives = useCharacterStore((state) => state.passives);
  const traits = useCharacterStore((state) => state.traits);
  const built = useCharacterStore((state) => state.built);
  const selectTrait = useCharacterStore((state) => state.selectTrait);
  const deselectTrait = useCharacterStore((state) => state.deselectTrait);
  const finalize = useCharacterStore((state) => state.finalize);
  const hydrate = useCharacterStore((state) => state.hydrate);
  const reset = useCharacterStore((state) => state.reset);

  const addTrait = useCallback(
    (trait: TraitSpec) => {
      selectTrait(trait);
    },
    [selectTrait]
  );

  const removeTrait = useCallback(
    (traitId: string) => {
      deselectTrait(traitId);
    },
    [deselectTrait]
  );

  const getSummary = useCallback(
    (): CharacterSummary => ({ stats, passives, traits, remaining, budget, built }),
    [built, budget, passives, remaining, stats, traits]
  );

  const finalizeCharacter = useCallback(
    (options?: { publish?: Publish; localParticipantId?: string | null; body?: string; context?: string }) => {
      finalize();
      if (options?.publish && options.localParticipantId && options.body) {
        options.publish(
          'chat:append:request',
          { body: options.body, authorId: options.localParticipantId },
          options.context ?? 'character:finalized'
        );
      }
    },
    [finalize]
  );

  const hydrateFromSnapshot = useCallback(
    (snapshot: CharacterSnapshot | CharacterLoadout) => {
      hydrate({
        built: snapshot.built,
        budget: snapshot.budget,
        remaining: snapshot.remaining,
        stats: snapshot.stats,
        passives: snapshot.passives,
        traits: snapshot.traits
      });
    },
    [hydrate]
  );

  const clear = useCallback(() => {
    reset();
  }, [reset]);

  const summary = useMemo(
    () => ({ stats, passives, traits, remaining, budget, built }),
    [built, budget, passives, remaining, stats, traits]
  );

  return {
    budget,
    remaining,
    stats,
    passives,
    traits,
    built,
    addTrait,
    removeTrait,
    finalizeCharacter,
    hydrateFromSnapshot,
    clear,
    getSummary,
    summary
  };
}

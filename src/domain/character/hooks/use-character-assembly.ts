import { useCallback, useMemo } from 'react';
import {
  useCharacterStore,
  type TraitSpec,
  type Passive,
  type StatKey,
  type CharacterSnapshot
} from '../../../store/character';
import type { LobbyMessageBodies, LobbyMessageKind } from '../../../protocol';
import type { CharacterLoadout } from '../types';

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export type Publish = <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context?: string) => boolean;

export type CharacterSummary = {
  roll: [number, number, number] | null;
  stats: Record<StatKey, number>;
  passives: Passive[];
  traits: TraitSpec[];
  remaining: number;
  budget: number;
  built: boolean;
};

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
    (): CharacterSummary => ({
      roll,
      stats,
      passives,
      traits,
      remaining,
      budget,
      built
    }),
    [built, budget, passives, remaining, roll, stats, traits]
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
        roll: snapshot.roll,
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
    () => ({
      roll,
      stats,
      passives,
      traits,
      remaining,
      budget,
      built
    }),
    [built, budget, passives, remaining, roll, stats, traits]
  );

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

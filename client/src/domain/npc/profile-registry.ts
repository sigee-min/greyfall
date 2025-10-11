import type { NpcProfile } from './types';

const byProfileId = new Map<string, NpcProfile>();
const byActorId = new Map<string, NpcProfile>();

export function registerProfile(profile: NpcProfile) {
  byProfileId.set(profile.id, profile);
}

export function mapActorToProfile(actorId: string, profile: NpcProfile) {
  byActorId.set(actorId, profile);
  registerProfile(profile);
}

export function unmapActor(actorId: string) {
  byActorId.delete(actorId);
}

export function getProfileById(profileId: string): NpcProfile | undefined {
  return byProfileId.get(profileId);
}

export function getProfileByActor(actorId: string): NpcProfile | undefined {
  return byActorId.get(actorId);
}


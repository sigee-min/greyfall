import { worldActorsClient, type ActorEntry } from '../../domain/net-objects/world-actors-client';

export function readActor(id: string): ActorEntry | null {
  return worldActorsClient.getFor(id);
}

export function subscribeActor(id: string, cb: (e: ActorEntry | null) => void): () => void {
  return worldActorsClient.subscribe((list) => cb(list.find((x) => x.id === id) ?? null));
}


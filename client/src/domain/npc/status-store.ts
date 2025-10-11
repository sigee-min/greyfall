import { getHostObject } from '../net-objects/registry.js';
import { WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
import type { HostWorldActorsObject } from '../net-objects/world-actors-host.js';

type StatusEntry = { key: string; expiresAt: number };
const byActor = new Map<string, StatusEntry[]>();
let _statusTimer: ReturnType<typeof setInterval> | null = null;

export function applyStatus(actorId: string, key: string, durationMs: number): void {
  const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
  if (!actors) return;
  try { actors.statusAdd(actorId, key); } catch {}
  const list = byActor.get(actorId) ?? [];
  const expiresAt = Date.now() + Math.max(200, durationMs);
  list.push({ key, expiresAt });
  byActor.set(actorId, list);
  ensureTimer();
}

function ensureTimer() {
  if (_statusTimer) return;
  _statusTimer = setInterval(tickStatuses, 500);
}

function tickStatuses() {
  const now = Date.now();
  const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
  if (!actors) return;
  for (const [actorId, list] of byActor.entries()) {
    const remain: StatusEntry[] = [];
    for (const e of list) {
      if (e.expiresAt <= now) {
        try { actors.statusRemove(actorId, e.key); } catch {}
      } else {
        remain.push(e);
      }
    }
    if (remain.length > 0) byActor.set(actorId, remain); else byActor.delete(actorId);
  }
}


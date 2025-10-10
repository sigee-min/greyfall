import { useEffect, useMemo, useState } from 'react';
import { subscribeActor, readActor } from '../../app/adapters/net-actors-adapter';
import { previewWithChange } from '../../domain/equipment/preview';
import type { StatKey } from '../../domain/stats/keys';
import { useCharacterLoadouts } from '../../domain/character/character-sync';
import type { PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import type { LobbyMessageBodies } from '../../protocol';
import { canEquipSlotOnly } from '../../app/services/equipment-service';

export function useEquipmentSnapshot(actorId: string | null) {
  const [entry, setEntry] = useState(() => (actorId ? readActor(actorId) : null));
  useEffect(() => {
    if (!actorId) return;
    setEntry(readActor(actorId));
    return subscribeActor(actorId, setEntry);
  }, [actorId]);
  return useMemo(() => ({
    equipment: entry?.equipment ?? [],
    inventory: entry?.inventory ?? [],
    modifiers: entry?.modifiers,
    derived: entry?.derived,
    effectsHash: entry?.effectsHash
  }), [entry]);
}

export function useEquipmentPreview(actorId: string | null, change: { add?: string; remove?: string } | null) {
  const loadouts = useCharacterLoadouts();
  const base: Record<StatKey, number> | null = useMemo(() => {
    if (!actorId) return null;
    const byId = loadouts.byId as unknown as Record<string, { stats?: Record<StatKey, number> }>;
    const stats = byId?.[actorId]?.stats;
    return stats ?? null;
  }, [actorId, loadouts.byId]);
  const [entry, setEntry] = useState(() => (actorId ? readActor(actorId) : null));
  useEffect(() => {
    if (!actorId) return;
    setEntry(readActor(actorId));
    return subscribeActor(actorId, setEntry);
  }, [actorId]);
  return useMemo(() => {
    if (!actorId || !entry || !base || !change) return null;
    return previewWithChange(entry, base, change);
  }, [actorId, entry, base, change]);
}

export function useEquipActions(actorId: string | null, publish: PublishLobbyMessage | null) {
  const [busy, setBusy] = useState(false);
  async function equip(itemKey: string) {
    if (!actorId || !publish) return { ok: false, reason: 'unavailable' } as const;
    const check = canEquipSlotOnly(actorId, itemKey);
    if (!check.allowed) return { ok: false, reason: check.reason } as const;
    setBusy(true);
    try {
      const body: LobbyMessageBodies['actors:equip:request'] = { actorId, key: itemKey };
      const ok = publish('actors:equip:request', body, 'ui:equip');
      return ok ? { ok: true } as const : { ok: false, reason: 'publish-failed' } as const;
    } finally { setBusy(false); }
  }
  async function unequip(itemKey: string) {
    if (!actorId || !publish) return { ok: false, reason: 'unavailable' } as const;
    setBusy(true);
    try {
      const body: LobbyMessageBodies['actors:unequip:request'] = { actorId, key: itemKey };
      const ok = publish('actors:unequip:request', body, 'ui:unequip');
      return ok ? { ok: true } as const : { ok: false, reason: 'publish-failed' } as const;
    } finally { setBusy(false); }
  }
  return { equip, unequip, busy } as const;
}

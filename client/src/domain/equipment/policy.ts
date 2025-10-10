export const EQUIP_COOLDOWN_MS = 1200;

export type MissionState = 'safe' | 'combat' | 'paused';

export const DEFAULT_MISSION_POLICY: Record<MissionState, { canEquip: boolean; canUnequip: boolean }> = {
  safe: { canEquip: true, canUnequip: true },
  combat: { canEquip: false, canUnequip: false },
  paused: { canEquip: false, canUnequip: false }
};


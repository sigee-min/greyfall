import {} from 'react';
import { useEquipmentSnapshot } from '../hooks/use-equipment';
import { formatDerived, formatResists } from '../../app/services/equipment-formatter';
import type { StatKey } from '../../domain/stats/keys';

type Props = { actorId: string | null };

export function EquipmentHudBadge({ actorId }: Props) {
  const snap = useEquipmentSnapshot(actorId);
  const line = (() => {
    const derived = snap.derived as Partial<Record<StatKey, number>> | undefined;
    const resists = snap.modifiers?.resists ?? {};
    const d = derived ? formatDerived(derived, 'ko') : '';
    const r = Object.keys(resists).length ? formatResists(resists, 'ko') : '';
    return [d, r].filter(Boolean).join(' • ');
  })();
  if (!line) return null;
  return (
    <div className="rounded-md border border-border/60 bg-background/70 px-3 py-1 text-[11px] text-foreground/90">
      {line}
    </div>
  );
}

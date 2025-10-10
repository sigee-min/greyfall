import { useMemo } from 'react';
import { getItemEffects } from '../../domain/equipment/effect-registry';
import { formatEffect } from '../../app/services/equipment-formatter';

type Props = { itemKey: string };

export function EquipmentTooltip({ itemKey }: Props) {
  const effects = useMemo(() => getItemEffects(itemKey), [itemKey]);
  if (!effects || effects.length === 0) return null;
  return (
    <div className="mt-1 rounded-md border border-border/60 bg-background/80 p-2 text-[11px] text-muted-foreground">
      <ul className="list-disc pl-4">
        {effects.map((e, i) => (
          <li key={i}>{formatEffect(e, 'ko')}</li>
        ))}
      </ul>
    </div>
  );
}


import { useMemo } from 'react';
import { getItemEffects } from '../../domain/equipment/effect-registry';
import { formatEffect } from '../../app/services/equipment-formatter';
import { getSetName, getSetTierDesc, hasSetMeta } from '../../domain/equipment/sets-catalog';

type Props = { itemKey: string };

export function EquipmentTooltip({ itemKey }: Props) {
  const effects = useMemo(() => getItemEffects(itemKey), [itemKey]);
  if (!effects || effects.length === 0) return null;
  const setId = effects.find((e) => typeof (e as { setId?: string }).setId === 'string')?.setId as string | undefined;
  return (
    <div className="mt-1 rounded-md border border-border/60 bg-background/80 p-2 text-[11px] text-muted-foreground">
      <ul className="list-disc pl-4">
        {effects.map((e, i) => (
          <li key={i}>{formatEffect(e, 'ko')}</li>
        ))}
      </ul>
      {setId && hasSetMeta(setId) && (
        <div className="mt-2">
          <div className="mb-1 text-foreground/80">세트: {getSetName(setId, 'ko')}</div>
          <ul className="list-disc pl-4">
            {[2, 4, 6].map((t) => (
              <li key={t}> {t}세트: {getSetTierDesc(setId, t as 2|4|6, 'ko') ?? '—'}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

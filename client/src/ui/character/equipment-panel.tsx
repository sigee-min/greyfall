import { useState } from 'react';
import type { PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import { useEquipmentSnapshot, useEquipmentPreview, useEquipActions } from '../hooks/use-equipment';
import { getItem } from '../../domain/items/registry';
import { useGlobalBus } from '../../bus/global-bus';
import { EquipmentTooltip } from './equipment-tooltip';
import { formatDerived, formatResists, formatSetsProgress, reasonToMessageKey } from '../../app/services/equipment-formatter';
import type { SetsProgress } from '../../domain/equipment/effect-types';
import type { StatKey } from '../../domain/stats/keys';
import { useI18n } from '../../i18n';

type Props = {
  actorId: string | null;
  publish: PublishLobbyMessage | null;
};

export function EquipmentPanel({ actorId, publish }: Props) {
  const { t } = useI18n();
  const snap = useEquipmentSnapshot(actorId);
  const bus = useGlobalBus();
  const [hoverAdd, setHoverAdd] = useState<string | null>(null);
  const [hoverRemove, setHoverRemove] = useState<string | null>(null);
  const preview = useEquipmentPreview(actorId, hoverAdd ? { add: hoverAdd } : hoverRemove ? { remove: hoverRemove } : null);
  const { equip, unequip, busy } = useEquipActions(actorId, publish);

  const inv = snap.inventory;
  const eq = snap.equipment;
  const derivedStats: Partial<Record<StatKey, number>> = (preview?.derived ?? snap.derived ?? {}) as Partial<Record<StatKey, number>>;
  const resists: Record<string, number> = (preview?.modifiers?.resists ?? snap.modifiers?.resists ?? {}) as Record<string, number>;
  const setsProgress: SetsProgress[] | undefined = (preview?.setsProgress ?? (snap as { setsProgress?: SetsProgress[] }).setsProgress);

  const title = (() => {
    const d = formatDerived(derivedStats, 'ko');
    const r = formatResists(resists, 'ko');
    const s = Array.isArray(setsProgress) && setsProgress.length ? formatSetsProgress(setsProgress, 'ko') : '';
    return [d, r, s].filter(Boolean).join(' • ');
  })();

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="uppercase tracking-[0.28em] text-muted-foreground">Equipment</span>
        <span className="text-muted-foreground">{title || '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Equipped</p>
          <div className="space-y-1">
            {eq.length === 0 && <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1">—</div>}
            {eq.map((k) => (
              <div key={k} className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-2 py-1"
                   onMouseEnter={() => setHoverRemove(k)} onMouseLeave={() => setHoverRemove(null)}>
                <span>{getItem(k)?.names?.[0]?.text ?? k}</span>
                <button disabled={busy} onClick={() => unequip(k)} className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary">Unequip</button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Inventory</p>
          <div className="space-y-1">
            {inv.length === 0 && <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1">—</div>}
            {inv.map((i) => (
              <div key={i.key} className="rounded-md border border-border/60 bg-background/50 px-2 py-1"
                   onMouseEnter={() => setHoverAdd(i.key)} onMouseLeave={() => setHoverAdd(null)}>
                <div className="flex items-center justify-between">
                  <span>{getItem(i.key)?.names?.[0]?.text ?? i.key} × {i.count}</span>
                  <button
                  disabled={busy || i.count <= 0}
                  onClick={async () => {
                    const res = await equip(i.key);
                    if (!res.ok) {
                      const key = reasonToMessageKey(res.reason);
                      const msg = t(key);
                      bus.publish('toast:show', { status: 'warning', title: t('equip.toast.rejected'), message: msg, durationMs: 2000 });
                    }
                  }}
                  className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary"
                >
                  Equip
                </button>
                </div>
                {hoverAdd === i.key && <EquipmentTooltip itemKey={i.key} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

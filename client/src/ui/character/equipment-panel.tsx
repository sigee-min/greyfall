import { useState } from 'react';
import type { PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import { useEquipmentSnapshot, useEquipmentPreview, useEquipActions } from '../hooks/use-equipment';
import { getItem } from '../../domain/items/registry';
import { useGlobalBus } from '../../bus/global-bus';
import { EquipmentTooltip } from './equipment-tooltip';
import { formatDerived, formatResists } from '../../app/services/equipment-formatter';
import type { StatKey } from '../../domain/stats/keys';

type Props = {
  actorId: string | null;
  publish: PublishLobbyMessage | null;
};

export function EquipmentPanel({ actorId, publish }: Props) {
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

  const title = (() => {
    const d = formatDerived(derivedStats, 'ko');
    const r = formatResists(resists, 'ko');
    return [d, r].filter(Boolean).join(' • ');
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
                      const msg = res.reason === 'slot-capacity' ? '해당 슬롯이 가득 찼습니다.' : res.reason === 'combat-restricted' ? '전투 중에는 장비를 교체할 수 없습니다.' : '장착할 수 없습니다.';
                      bus.publish('toast:show', { status: 'warning', title: '장착 불가', message: msg, durationMs: 2000 });
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

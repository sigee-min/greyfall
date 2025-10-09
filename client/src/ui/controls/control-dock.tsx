import { nanoid } from 'nanoid';
import { useGreyfallStore } from '../../store';

export function ControlDock() {
  const appendLog = useGreyfallStore((state) => state.appendLog);
  const upsertToken = useGreyfallStore((state) => state.upsertToken);
  const setFog = useGreyfallStore((state) => state.setFog);
  const setFogReveals = useGreyfallStore((state) => state.setFogReveals);
  const currentFog = useGreyfallStore((state) => state.scene.fog);

  const seedScene = () => {
    const id = nanoid(8);
    const position = { x: Math.random() * 600 + 200, y: Math.random() * 300 + 140 };
    upsertToken({
      id,
      label: `Scout ${id}`,
      position,
      tint: 0x38bdf8
    });
    setFog({ enabled: true });
    const reveals = currentFog.reveals.filter((reveal) => reveal.id !== id);
    setFogReveals([...reveals, { id, position, radius: 160 }]);
    appendLog({ id: nanoid(6), body: `Token ${id} deployed.` });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-secondary-foreground transition hover:bg-secondary/60"
        onClick={seedScene}
      >
        Deploy Token
      </button>
      <button
        type="button"
        className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-secondary-foreground transition hover:bg-secondary/60"
        onClick={() => appendLog({ id: nanoid(6), body: 'Log marker created.' })}
      >
        Append Log
      </button>
    </div>
  );
}

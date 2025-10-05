import { FormEvent, useState } from 'react';
import { nanoid } from 'nanoid';
import { requestChoices, type CardPrompt } from '../../llm/webgpu';
import { useCharacterStore, type StatKey } from '../../store/character';
import type { LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { useGreyfallStore } from '../../store';

export function CommandConsole({ publish, localParticipantId }: { publish: <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context?: string) => boolean; localParticipantId: string | null }) {
  const appendLog = useGreyfallStore((state) => state.appendLog);
  const [intent, setIntent] = useState('');
  const [choices, setChoices] = useState<CardPrompt & { id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stats = useCharacterStore((s) => s.stats);
  // publish/localParticipantId come from props

  function parseRoll(input: string): { dice: number; mod: number; label: string } | null {
    const m = input.trim().match(/^\/roll\s+(.+)$/i);
    if (!m) return null;
    const expr = m[1].trim();
    // stat+N or d20+N
    if (/^d?20(\s*[+\-]\s*\d+)?$/i.test(expr)) {
      const mm = expr.match(/^d?20(\s*([+\-])\s*(\d+))?$/i)!;
      const sign = mm[2] === '-' ? -1 : 1;
      const mod = mm[3] ? sign * parseInt(mm[3], 10) : 0;
      return { dice: 20, mod, label: 'd20' };
    }
    // stat name [+/-N]
    const m2 = expr.match(/^([\S]+)(\s*([+\-])\s*(\d+))?$/);
    if (!m2) return null;
    const key = m2[1] as StatKey;
    const base = (stats as any)[key] ?? 0;
    const sign2 = m2[3] === '-' ? -1 : 1;
    const extra = m2[4] ? sign2 * parseInt(m2[4], 10) : 0;
    return { dice: 20, mod: base + extra, label: key };
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intent.trim()) return;

    // Handle /roll first
    const parsed = parseRoll(intent);
    if (parsed) {
      const d = Math.floor(Math.random() * parsed.dice) + 1;
      const total = d + parsed.mod;
      const summary = `/roll ${parsed.label} → [${d}] ${parsed.mod >= 0 ? '+' : ''}${parsed.mod} = ${total}`;
      appendLog({ id: nanoid(6), body: summary });
      if (localParticipantId) publish('chat:append:request' as any, { body: summary, authorId: localParticipantId } as any, 'roll');
      setIntent('');
      return;
    }

    const prompt: CardPrompt = {
      scene: 'active',
      intent: intent.trim()
    };

    setLoading(true);
    setError(null);

    try {
      const response = await requestChoices(prompt);
      setChoices({ ...prompt, id: response.promptId });
      appendLog({ id: nanoid(6), body: `LLM narrative queued: ${response.narrative}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach local LLM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/50">
      <form onSubmit={handleSubmit} className="space-y-3 p-4">
        <header>
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">Choice Prompt</h2>
        </header>
        <textarea
          className="h-24 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="Briefly describe the next beat you want the LLM to elaborate."
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="off"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-primary bg-primary/90 px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-primary-foreground transition hover:bg-primary"
          disabled={loading}
        >
          {loading ? 'Aligning...' : 'Request Choices'}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {choices && (
          <div className="rounded-md border border-border/50 bg-background/70 p-3 text-xs text-muted-foreground">
            <p className="font-semibold">Prompt {choices.id}</p>
            <p>{choices.intent}</p>
          </div>
        )}
      </form>
    </section>
  );
}

import { FormEvent, useState } from 'react';
import { nanoid } from 'nanoid';
import { requestChoices, type CardPrompt } from '../../llm/webgpu';
import { useGreyfallStore } from '../../store';

export function CommandConsole() {
  const appendLog = useGreyfallStore((state) => state.appendLog);
  const [intent, setIntent] = useState('');
  const [choices, setChoices] = useState<CardPrompt & { id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intent.trim()) return;

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

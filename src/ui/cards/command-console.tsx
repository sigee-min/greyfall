import { FormEvent, useState } from 'react';
import { nanoid } from 'nanoid';
type CardPrompt = { scene: string; intent: string; constraints?: string[] };
import { useCharacterStore, type StatKey } from '../../store/character';
import { computeModifiers, type CheckKind } from '../../domain/character/checks';
import { useGlobalBus } from '../../bus/global-bus';
import type { LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { useGreyfallStore } from '../../store';
import { useI18n } from '../../i18n';

type Publish = <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context?: string) => boolean;

const STAT_KEYS: readonly StatKey[] = ['Strength', 'Agility', 'Engineering', 'Dexterity', 'Medicine'] as const;
const STAT_KEY_ALIASES: Record<string, StatKey> = {
  근력: 'Strength',
  운동신경: 'Agility',
  공학: 'Engineering',
  손재주: 'Dexterity',
  의술: 'Medicine'
};

function resolveStatKey(value: string): StatKey | null {
  if (STAT_KEYS.includes(value as StatKey)) return value as StatKey;
  return STAT_KEY_ALIASES[value] ?? null;
}

export function CommandConsole({ publish, localParticipantId }: { publish: Publish; localParticipantId: string | null }) {
  const { t } = useI18n();
  const appendLog = useGreyfallStore((state) => state.appendLog);
  const [intent, setIntent] = useState('');
  const [choices, setChoices] = useState<CardPrompt & { id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stats = useCharacterStore((s) => s.stats);
  const passives = useCharacterStore((s) => s.passives);
  const bus = useGlobalBus();
  // publish/localParticipantId come from props

  function parseRoll(input: string): { dice: number; mod: number; label: string } | null {
    const m = input.trim().match(/^\/roll\s+(.+)$/i);
    if (!m) return null;
    const expr = m[1].trim();
    // check keywords
    const ckMap: Record<string, CheckKind> = {
      'evade': 'evade', '회피': 'evade',
      'triage': 'triage', '응급': 'triage', '의무': 'triage',
      'precision': 'precision', '정밀': 'precision',
      'eng': 'engineering', 'engineering': 'engineering', '공학': 'engineering',
      'med': 'medicine', 'medicine': 'medicine', '의술': 'medicine'
    };
    if (ckMap[expr]) {
      const kind = ckMap[expr];
      const { mod, labels } = computeModifiers({ stats, passives, kind });
      return { dice: 20, mod, label: labels.join('+') };
    }
    // stat+N or d20+N
    if (/^d?20(\s*[+-]\s*\d+)?$/i.test(expr)) {
      const mm = expr.match(/^d?20(\s*([+-])\s*(\d+))?$/i)!;
      const sign = mm[2] === '-' ? -1 : 1;
      const mod = mm[3] ? sign * parseInt(mm[3], 10) : 0;
      return { dice: 20, mod, label: 'd20' };
    }
    // stat name [+/-N]
    const m2 = expr.match(/^([\S]+)(\s*([+-])\s*(\d+))?$/);
    if (!m2) return null;
    const keyCandidate = m2[1];
    const key = resolveStatKey(keyCandidate);
    if (!key) return null;
    const base = stats[key] ?? 0;
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
      const isCrit = d === 20;
      const isFail = d === 1;
      const dieIcon = '🎲';
      const critIcon = isCrit ? '✨' : isFail ? '💥' : '';
      const summary = `${dieIcon} /roll ${parsed.label} → [${d}] ${parsed.mod >= 0 ? '+' : ''}${parsed.mod} = ${total} ${critIcon}`;
      appendLog({ id: nanoid(6), body: summary });
      if (localParticipantId) publish('chat:append:request', { body: summary, authorId: localParticipantId }, 'roll');
      bus.publish('toast:show', { title: t('console.roll'), message: summary, status: isCrit ? 'success' : isFail ? 'warning' : 'info', durationMs: 2200, icon: '🎲' });
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
      const response = await (async function requestChoicesOffline(_prompt: CardPrompt) {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `offline-${Date.now()}`;
        return {
          promptId: id,
          narrative: 'The model is offline. Use manual narration.',
          choices: [
            { id: 'fallback-1', label: 'Maintain position and observe', risk: 'time', target: 10 },
            { id: 'fallback-2', label: 'Advance cautiously', risk: 'noise', target: 13 }
          ]
        } as const;
      })(prompt);
      setChoices({ ...prompt, id: response.promptId });
      appendLog({ id: nanoid(6), body: t('console.queued', { narrative: response.narrative }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('console.llmFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/50">
      <form onSubmit={handleSubmit} className="space-y-3 p-4">
        <header>
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">{t('console.title')}</h2>
        </header>
        <textarea
          className="h-24 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder={t('console.placeholder')}
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
          {loading ? t('console.aligning') : t('console.request')}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {choices && (
          <div className="rounded-md border border-border/50 bg-background/70 p-3 text-xs text-muted-foreground">
            <p className="font-semibold">{t('console.promptId', { id: choices.id })}</p>
            <p>{choices.intent}</p>
          </div>
        )}
      </form>
    </section>
  );
}

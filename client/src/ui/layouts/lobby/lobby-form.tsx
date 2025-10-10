import { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';
import { useI18n } from '../../../i18n';
import type { LobbyLayoutProps } from './types';

type LobbyFormClasses = {
  container?: string;
  panel?: string;
  label?: string;
  input?: string;
  help?: string;
  actions?: string;
  button?: string;
  meta?: string;
};

type LobbyFormProps = Omit<LobbyLayoutProps, 'background'> & {
  classes?: LobbyFormClasses;
};

export function LobbyForm({
  playerName,
  joinCode,
  canCreate,
  canJoin,
  onNameChange: _onNameChange,
  onJoinCodeChange,
  onCreate,
  onJoin,
  onOptions,
  onAbout,
  classes
}: LobbyFormProps) {
  const { t } = useI18n();
  const baseLabel = 'text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-200/80 sm:text-xs';
  const baseInput =
    'w-full rounded-md border border-slate-100/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/70';
  // Load server-side profile for avatar (best effort)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('../../../lib/auth-session');
        const json = await mod.getUsersMeDedup();
        if (!cancelled && json.ok) setAvatarUrl(json.user?.picture ?? null);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={cn('w-full max-w-sm space-y-6 sm:max-w-sm', classes?.container)}>
      <div className={cn('space-y-2', classes?.panel)}>
        <label htmlFor="player-name" className={cn(baseLabel, classes?.label)}>
          {t('lobby.profile')}
        </label>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-border/60 bg-background/60">
            {avatarUrl ? (
              <img src={avatarUrl} alt={playerName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{playerName?.[0] ?? 'P'}</div>
            )}
          </div>
          <p
            id="player-name"
            title={playerName || t('lobby.callsign.placeholder')}
            className={cn('min-h-[2.5rem] w-full truncate rounded-md px-1.5 py-1.5 text-sm text-slate-100', classes?.input)}
          >
            {playerName || t('lobby.callsign.placeholder')}
          </p>
        </div>
      </div>

      <div className={cn('space-y-2', classes?.panel)}>
        <label htmlFor="join-code" className={cn(baseLabel, classes?.label)}>
          {t('lobby.joinCode')}
        </label>
        <input
          id="join-code"
          name="greyfall-join-code"
          value={joinCode}
          onChange={(event) => onJoinCodeChange(event.target.value)}
          placeholder={t('lobby.joinCode.placeholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="off"
          inputMode="text"
          className={cn(baseInput, classes?.input)}
        />
        <p className={cn('text-[0.7rem] text-slate-200/60 sm:text-xs', classes?.help)}>{t('lobby.joinCode.help')}</p>
      </div>

      <div className={cn('space-y-3', classes?.actions)}>
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          className={cn(
            'w-full rounded-md border border-primary/80 bg-primary/90 px-4 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 sm:tracking-[0.3em]',
            classes?.button
          )}
        >
          {t('lobby.create')}
        </button>
        <button
          type="button"
          onClick={onJoin}
          disabled={!canJoin}
          className={cn(
            'w-full rounded-md border border-slate-100/20 bg-slate-900/60 px-4 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-slate-100 transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 sm:tracking-[0.3em]',
            classes?.button
          )}
        >
          {t('lobby.join')}
        </button>
      </div>

      <div
        className={cn(
          'flex flex-col items-center justify-between gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-300/70 sm:flex-row sm:gap-4 sm:text-xs sm:tracking-[0.25em]',
          classes?.meta
        )}
      >
        <button type="button" onClick={onOptions} className="transition hover:text-primary">
          {t('common.options')}
        </button>
        <button type="button" onClick={onAbout} className="transition hover:text-primary">
          {t('lobby.devInfo')}
        </button>
      </div>
    </div>
  );
}

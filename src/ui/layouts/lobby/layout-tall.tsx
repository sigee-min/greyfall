import { FallbackBackground } from '../../common/fallback-bg';
import { useI18n } from '../../../i18n';
import { LobbyForm } from './lobby-form';
import type { LobbyLayoutProps } from './types';

function LobbyTallLayout({
  playerName,
  joinCode,
  canCreate,
  canJoin,
  onNameChange,
  onJoinCodeChange,
  onCreate,
  onJoin,
  onOptions,
  onAbout,
  background
}: LobbyLayoutProps) {
  const { t } = useI18n();

  return (
    <div className="relative flex h-screen min-h-screen w-screen flex-col overflow-hidden bg-slate-950 text-foreground">
      <FallbackBackground src={background} objectFit="cover" objectPosition="center 38%" />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/45 to-slate-900/20" />

      <section className="relative z-10 flex h-full flex-col justify-between px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-lg text-center text-slate-100 drop-shadow-lg">
          <h1 className="text-3xl font-semibold uppercase tracking-[0.2em] sm:text-4xl">
            {t('lobby.title.line1')}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.35em] text-primary/90 sm:text-sm">
            {t('lobby.title.line2')}
          </p>
          <p className="mt-4 text-sm text-slate-200/80 sm:text-base">{t('lobby.description')}</p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <LobbyForm
            playerName={playerName}
            joinCode={joinCode}
            canCreate={canCreate}
            canJoin={canJoin}
            onNameChange={onNameChange}
            onJoinCodeChange={onJoinCodeChange}
            onCreate={onCreate}
            onJoin={onJoin}
            onOptions={onOptions}
            onAbout={onAbout}
            classes={{
              container: 'rounded-3xl border border-slate-100/10 bg-slate-950/70 p-6 shadow-xl backdrop-blur-md sm:p-8',
              input: 'bg-slate-900/70',
              button: 'sm:tracking-[0.28em]',
              meta: 'flex-row sm:flex-row sm:justify-between'
            }}
          />
        </div>
      </section>
    </div>
  );
}

export default LobbyTallLayout;

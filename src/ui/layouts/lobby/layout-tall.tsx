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
      <FallbackBackground src={background} objectFit="cover" objectPosition="center 34%" />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/38 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-slate-950/82" />

      <section className="relative z-10 flex h-full flex-col justify-between px-6 py-10 sm:px-10">
        <div className="flex w-full justify-center">
          <div className="max-w-md text-center text-slate-100 drop-shadow-[0_16px_32px_rgba(2,6,23,0.55)]">
            <h1 className="text-4xl font-semibold uppercase tracking-[0.22em] sm:text-5xl">
            {t('lobby.title.line1')}
            </h1>
            <p className="mt-3 text-sm uppercase tracking-[0.38em] text-primary/85 sm:text-base">
            {t('lobby.title.line2')}
            </p>
            <p className="mt-4 text-base text-slate-200/80 sm:text-lg">{t('lobby.description')}</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
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
              container:
                'rounded-3xl border border-slate-100/12 bg-slate-950/78 px-5 py-5 shadow-[0_16px_32px_rgba(2,6,23,0.42)] backdrop-blur-lg sm:px-6 sm:py-6',
              input: 'bg-slate-900/60',
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

import { FallbackBackground } from '../../common/fallback-bg';
import { useI18n } from '../../../i18n';
import { LobbyForm } from './lobby-form';
import type { LobbyLayoutProps } from './types';

function LobbyStandardLayout({
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
    <div className="relative flex h-screen min-h-screen w-screen overflow-hidden bg-slate-950 text-foreground">
      <FallbackBackground src={background} objectFit="cover" objectPosition="center 32%" />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/38 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-slate-950/82" />

      <section className="relative z-10 flex h-full w-full flex-col justify-between gap-10 px-6 py-12 sm:px-10 md:px-14 lg:px-16 xl:px-20">
        <header className="flex flex-col items-center gap-5 text-center sm:items-end sm:text-right">
          <div className="flex flex-col items-center gap-5 sm:items-end">
            <h1 className="max-w-3xl text-4xl font-semibold uppercase tracking-[0.2em] text-slate-100 drop-shadow-[0_22px_45px_rgba(2,6,23,0.7)] sm:text-5xl sm:tracking-[0.24em] lg:text-6xl lg:tracking-[0.3em]">
              {t('lobby.title.line1')}
            </h1>
            <p className="text-xs uppercase tracking-[0.4em] text-primary/80 sm:text-sm sm:tracking-[0.46em] lg:text-base lg:tracking-[0.5em]">
              {t('lobby.title.line2')}
            </p>
            <p className="max-w-2xl text-sm text-slate-200/85 sm:text-base lg:text-lg lg:text-slate-100/85">
              {t('lobby.description')}
            </p>
          </div>
        </header>

        <div className="flex w-full justify-center sm:justify-start">
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
                'w-full max-w-md rounded-3xl border border-slate-100/12 bg-slate-950/78 px-6 py-6 shadow-[0_22px_45px_rgba(2,6,23,0.5)] backdrop-blur-lg transition sm:max-w-lg sm:px-8 sm:py-7 lg:max-w-xl'
            }}
          />
        </div>
      </section>
    </div>
  );
}

export default LobbyStandardLayout;

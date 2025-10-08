import { FallbackBackground } from '../../common/fallback-bg';
import { useI18n } from '../../../i18n';
import { LobbyForm } from './lobby-form';
import type { LobbyLayoutProps } from './types';

function LobbyWideLayout({
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
      <FallbackBackground src={background} objectFit="cover" objectPosition="center" />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/38 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-slate-950/82" />

      <section className="relative z-10 flex h-full w-full">
        <div className="mx-auto flex h-full w-full max-w-[1920px] flex-col justify-between gap-10 px-8 py-12 lg:px-16 xl:flex-row xl:items-center xl:gap-24">
          <article className="flex w-full max-w-2xl flex-col gap-5 text-left xl:max-w-3xl">
            <p className="text-xs uppercase tracking-[0.38em] text-primary/70 lg:text-sm lg:tracking-[0.42em]">
              {t('lobby.brand')}
            </p>
            <h1 className="text-5xl font-semibold uppercase tracking-[0.22em] text-slate-100 drop-shadow-[0_24px_48px_rgba(2,6,23,0.7)] lg:text-6xl lg:tracking-[0.28em] xl:text-7xl xl:tracking-[0.34em]">
              {t('lobby.title.line1')}
            </h1>
            <p className="text-base uppercase tracking-[0.38em] text-primary/80 lg:text-lg lg:tracking-[0.48em]">
              {t('lobby.title.line2')}
            </p>
            <p className="mt-2 max-w-xl text-base text-slate-200/90 lg:text-lg xl:text-xl xl:text-slate-100/85">
              {t('lobby.description')}
            </p>
            <div className="mt-6 hidden h-[2px] w-32 bg-primary/50 lg:block" />
            <p className="hidden max-w-sm text-xs uppercase tracking-[0.3em] text-slate-200/70 lg:block">
              {t('lobby.joinCode.help')}
            </p>
          </article>

          <div className="w-full max-w-xl rounded-3xl border border-slate-100/12 bg-slate-950/78 px-6 py-6 shadow-[0_24px_50px_rgba(2,6,23,0.48)] backdrop-blur-lg sm:px-8 sm:py-8 lg:max-w-2xl xl:max-w-xl">
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
                container: 'space-y-8 max-w-none sm:max-w-none xl:max-w-none',
                button: 'tracking-[0.26em] text-sm lg:text-base',
                input: 'bg-slate-900/55 text-base',
                label: 'tracking-[0.28em] text-xs text-slate-200/80',
                meta: 'justify-between text-[11px] text-slate-300/80',
                help: 'text-[11px] text-slate-300/70'
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default LobbyWideLayout;

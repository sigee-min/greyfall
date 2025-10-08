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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-slate-950" />
      <FallbackBackground src={background} objectFit="contain" objectPosition="center" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/30 via-slate-900/45 to-slate-950/75" />

      <section className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] flex-col justify-between px-10 py-14">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/80">{t('lobby.brand')}</p>
            <h1 className="mt-2 text-4xl font-semibold uppercase tracking-[0.26em] text-slate-100 drop-shadow-lg">
              {t('lobby.title.line1')}
            </h1>
            <p className="mt-1 text-sm uppercase tracking-[0.4em] text-primary/85">{t('lobby.title.line2')}</p>
          </div>
          <p className="max-w-md text-right text-sm text-slate-200/85">{t('lobby.description')}</p>
        </div>

        <div className="flex items-end justify-between gap-12 pb-6">
          <div className="flex flex-1 flex-col gap-6">
            <div className="h-[2px] w-24 bg-primary/60" />
            <p className="max-w-sm text-xs uppercase tracking-[0.3em] text-slate-200/70">
              {t('lobby.joinCode.help')}
            </p>
          </div>

          <div className="w-full max-w-lg">
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
                  'rounded-3xl border border-slate-100/12 bg-slate-950/70 p-6 shadow-[0_0_40px_-10px_rgba(15,23,42,0.9)] backdrop-blur-md sm:p-8',
                button: 'tracking-[0.26em]',
                input: 'bg-slate-900/60',
                label: 'tracking-[0.28em]',
                meta: 'justify-between',
                help: 'hidden'
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default LobbyWideLayout;

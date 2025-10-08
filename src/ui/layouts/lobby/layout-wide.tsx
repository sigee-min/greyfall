import { useI18n } from '../../../i18n';
import { LobbyForm } from './lobby-form';
import type { LobbyLayoutProps } from './types';
import { LobbyBackdrop } from './components/lobby-backdrop';
import { LobbyHero } from './components/lobby-hero';

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
      <LobbyBackdrop src={background} />

      <section className="relative z-10 flex h-full w-full">
        <div className="mx-auto flex h-full w-full max-w-[1920px] flex-col justify-between gap-10 px-8 py-12 lg:px-16 xl:flex-row xl:items-center xl:gap-24">
          <LobbyHero
            brand={t('lobby.brand')}
            title={t('lobby.title.line1')}
            subtitle={t('lobby.title.line2')}
            description={t('lobby.description')}
            variant="wide"
            alignment="start"
          />

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

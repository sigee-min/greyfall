import { useI18n } from '../../../i18n';
import { LobbyForm } from './lobby-form';
import type { LobbyLayoutProps } from './types';
import { LobbyBackdrop } from './components/lobby-backdrop';
import { LobbyHero } from './components/lobby-hero';

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
      <LobbyBackdrop src={background} objectPosition="center 34%" />

      <section className="relative z-10 flex h-full flex-col justify-between px-6 py-10 sm:px-10">
        <div className="flex w-full justify-center">
          <LobbyHero
            title={t('lobby.title.line1')}
            subtitle={t('lobby.title.line2')}
            description={t('lobby.description')}
            variant="tall"
            alignment="center"
          />
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

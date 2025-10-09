import { useI18n } from '../../../i18n';
import { LobbyForm } from './lobby-form';
import type { LobbyLayoutProps } from './types';
import { LobbyBackdrop } from './components/lobby-backdrop';
import { LobbyHero } from './components/lobby-hero';

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
      <LobbyBackdrop src={background} objectPosition="center 32%" />

      <section className="relative z-10 flex h-full w-full flex-col justify-between gap-10 px-6 py-12 sm:px-10 md:px-14 lg:px-16 xl:px-20">
        <LobbyHero
          title={t('lobby.title.line1')}
          subtitle={t('lobby.title.line2')}
          description={t('lobby.description')}
          variant="standard"
          alignment="center"
          className="sm:items-end sm:text-right"
        />

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
                'w-full max-w-[19.5rem] rounded-3xl border border-slate-100/12 bg-slate-950/78 px-6 py-6 shadow-[0_22px_45px_rgba(2,6,23,0.5)] backdrop-blur-lg transition sm:max-w-[23.5rem] sm:px-8 sm:py-7 lg:max-w-[26rem]'
            }}
          />
        </div>
      </section>
    </div>
  );
}

export default LobbyStandardLayout;

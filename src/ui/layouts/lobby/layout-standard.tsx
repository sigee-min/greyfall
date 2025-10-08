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
      <div className="pointer-events-none absolute inset-0 bg-slate-950/18" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/15 via-slate-900/35 to-slate-950/65" />

      <section className="relative z-10 flex h-full w-full flex-col">
        <div className="absolute left-6 right-6 top-10 flex flex-col items-end gap-4 text-right sm:right-16 sm:top-16 sm:max-w-sm">
          <h1 className="text-4xl font-semibold uppercase tracking-[0.24em] text-slate-100 drop-shadow-xl sm:text-5xl sm:tracking-[0.3em]">
            {t('lobby.title.line1')}
          </h1>
          <p className="text-xs uppercase tracking-[0.4em] text-primary/85 sm:text-sm">
            {t('lobby.title.line2')}
          </p>
          <p className="mt-2 max-w-sm text-sm text-slate-200/85 sm:text-base">{t('lobby.description')}</p>
        </div>

        <div className="absolute bottom-10 left-6 right-6 sm:left-14 sm:right-auto sm:bottom-16">
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
              container: 'rounded-3xl border border-slate-100/12 bg-slate-950/65 p-6 shadow-2xl backdrop-blur-md transition sm:max-w-lg sm:p-8'
            }}
          />
        </div>
      </section>
    </div>
  );
}

export default LobbyStandardLayout;

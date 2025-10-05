import { useState } from 'react';
import { cn } from '../lib/utils';
import { FallbackBackground } from '../ui/common/fallback-bg';

type GameLobbyProps = {
  playerName: string;
  onNameChange: (value: string) => void;
  onCreate: (name: string) => void;
  onJoin: (name: string, joinCode: string) => void;
  onOptions: () => void;
  onAbout: () => void;
  background: string;
};

export function GameLobby({
  playerName,
  onNameChange,
  onCreate,
  onJoin,
  onOptions,
  onAbout,
  background
}: GameLobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const nameReady = playerName.trim().length > 0;
  const joinCodeFilled = joinCode.trim().length > 0;

  return (
    <div className="relative flex h-screen min-h-screen w-screen items-center justify-between overflow-hidden bg-slate-950 text-foreground">
      <FallbackBackground src={background} />
      <div className="absolute inset-0 bg-slate-950/40" />

      <section className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center gap-12 px-6 py-12 sm:px-10 md:px-16 lg:flex-row lg:items-center lg:gap-20">
        <div className="flex-1 space-y-6 text-center lg:max-w-2xl lg:text-left">
          <p className="text-xs uppercase tracking-[0.35em] text-primary/80 sm:text-sm">Greyfall Initiative</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl xl:text-6xl">
            Lantern Circle<br />Operations Console
          </h1>
          <p className="mx-auto max-w-prose text-base text-muted-foreground lg:mx-0">
            잿빛 폭풍을 막기 위한 작전석에 오신 것을 환영합니다. 세션을 개설하거나 합류해 팀원들과 함께 Greyfall을 대비하세요.
          </p>
        </div>

        <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:max-w-lg sm:p-8 lg:max-w-md">
          <div className="space-y-2">
            <label htmlFor="player-name" className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Callsign
            </label>
            <input
              id="player-name"
              name="greyfall-callsign"
              value={playerName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="예: Ash-Runner"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="off"
              inputMode="text"
              className="w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="join-code" className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Join Code
            </label>
            <input
              id="join-code"
              name="greyfall-join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="호스트가 제공한 코드"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="off"
              inputMode="text"
              className="w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              새 게임을 만들면 자동으로 공유 코드가 생성됩니다. 기존 방에 참여할 때만 입력하세요.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                label: 'Create Game',
                onClick: () => onCreate(playerName.trim()),
                primary: true,
                disabled: joinCodeFilled
              },
              { label: 'Join Game', onClick: () => onJoin(playerName.trim(), joinCode.trim()) }
            ].map((button) => {
              const isDisabled =
                !nameReady ||
                (button.label === 'Join Game' && joinCode.trim().length === 0) ||
                Boolean(button.disabled);

              return (
                <button
                  key={button.label}
                  type="button"
                  onClick={button.onClick}
                  disabled={isDisabled}
                  className={cn(
                    'w-full rounded-md border px-4 py-3 text-sm font-semibold uppercase tracking-[0.24em] transition sm:tracking-[0.3em]',
                    button.primary
                      ? 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                      : 'border-border bg-background/70 text-foreground hover:border-primary/60',
                    isDisabled ? 'cursor-not-allowed opacity-50' : undefined
                  )}
                >
                  {button.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:flex-row sm:gap-4 sm:tracking-[0.25em]">
            <button type="button" onClick={onOptions} className="transition hover:text-primary">
              Options
            </button>
            <button type="button" onClick={onAbout} className="transition hover:text-primary">
              Developer Info
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

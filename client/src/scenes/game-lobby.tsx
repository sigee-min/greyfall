import { Suspense, useCallback, useMemo, useState } from 'react';
import { getLobbyLayout } from '../ui/layouts/lobby';
import { useAspectCategory } from '../ui/layouts/use-aspect-category';

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
  const joinCodeReady = joinCode.trim().length > 0;
  const aspectCategory = useAspectCategory();
  const LayoutComponent = useMemo(() => getLobbyLayout(aspectCategory), [aspectCategory]);

  const handleCreate = useCallback(() => {
    if (!nameReady || joinCodeReady) return;
    onCreate(playerName.trim());
  }, [joinCodeReady, nameReady, onCreate, playerName]);

  const handleJoin = useCallback(() => {
    if (!nameReady || !joinCodeReady) return;
    onJoin(playerName.trim(), joinCode.trim());
  }, [joinCode, joinCodeReady, nameReady, onJoin, playerName]);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
          Initialising lobby…
        </div>
      }
    >
      <LayoutComponent
        playerName={playerName}
        joinCode={joinCode}
        canCreate={nameReady && !joinCodeReady}
        canJoin={nameReady && joinCodeReady}
        onNameChange={onNameChange}
        onJoinCodeChange={setJoinCode}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onOptions={onOptions}
        onAbout={onAbout}
        background={background}
      />
    </Suspense>
  );
}

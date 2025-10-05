import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StageViewport } from './stage/stage-bridge';
import { ChatDock } from './ui/chat/chat-dock';
import { CommandConsole } from './ui/cards/command-console';
import { ControlDock } from './ui/controls/control-dock';
import { SettingsOverlay } from './ui/settings/settings-overlay';
import { OptionsDialog } from './ui/dialogs/options-dialog';
import { DeveloperDialog } from './ui/dialogs/developer-dialog';
import { ManagerSelectDialog } from './ui/dialogs/manager-select-dialog';
import { ErrorDialog } from './ui/dialogs/error-dialog';
import { GameLobby } from './scenes/game-lobby';
import { GameStartLobby } from './scenes/game-start-lobby';
import { useSession } from './domain/session';
import { useLobbyChat } from './domain/chat/use-lobby-chat';
import { exitFullscreen, getFullscreenElement, requestFullscreen, logFullscreenState } from './lib/fullscreen';
import { joinHostSession, startHostSession } from './rtc/webrtc';
import { selectResources, useGreyfallStore } from './store';
import {
  selectFullscreenEnabled,
  selectMusicEnabled,
  selectMusicVolume,
  selectPreferencesLoaded,
  usePreferencesStore
} from './store/preferences';
import { useUiSfx } from './lib/use-ui-sfx';
import { useBackgroundMusic } from './lib/background-music';
import { useCustomCursor } from './lib/use-custom-cursor';
import { useDisableAutofill } from './lib/use-disable-autofill';
import { useGlobalBus } from './bus/global-bus';
import { useGameBus } from './bus/game-bus';
import type { SceneKey } from './types/scenes';
import { FieldGraph } from './ui/world/field-graph';

const LOBBY_TRACKS: string[] = ['/assets/audio/lobby/main-theme.wav', '/assets/audio/lobby/main-theme.mp3'];

function App() {
  useUiSfx();
  useCustomCursor();
  useDisableAutofill();

  const resources = useGreyfallStore(selectResources);
  const [scene, setScene] = useState<SceneKey>('mainLobby');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<'hasty' | 'fast' | 'smart'>('smart');
  const [playerName, setPlayerName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const preferencesLoaded = usePreferencesStore(selectPreferencesLoaded);
  const fullscreenEnabled = usePreferencesStore(selectFullscreenEnabled);
  const musicEnabled = usePreferencesStore(selectMusicEnabled);
  const musicVolume = usePreferencesStore(selectMusicVolume);
  const loadPreferences = usePreferencesStore((state) => state.load);
  const setPreference = usePreferencesStore((state) => state.setPreference);
  const globalBus = useGlobalBus();
  const gameBus = useGameBus();

  const {
    participants,
    localParticipantId,
    sessionMeta,
    createGame,
    joinGame,
    toggleReady,
    leaveSession,
    startMissionReady,
    publishLobbyMessage,
    registerLobbyHandler
  } = useSession({ startHostSession, joinHostSession });

  const { chatMessages, sendChatMessage, canSendChat, channelOpen, probeChannel } = useLobbyChat({
    registerLobbyHandler,
    publishLobbyMessage,
    participants,
    localParticipantId,
    sessionMeta
  });

  const musicPlayEnabled = preferencesLoaded && musicEnabled;
  const { resume: resumeMusic, previewVolume: previewMusicVolume } = useBackgroundMusic(
    LOBBY_TRACKS,
    musicPlayEnabled,
    musicVolume,
    scene,
    LOBBY_TRACKS
  );

  const changeScene = useCallback(
    (next: SceneKey) => {
      setScene(next);
      gameBus.publish('scene:change', { scene: next });
    },
    [gameBus]
  );

  useEffect(() => {
    const unsubscribeShow = globalBus.subscribe('error:show', ({ message }) => setErrorMessage(message));
    const unsubscribeClear = globalBus.subscribe('error:clear', () => setErrorMessage(null));
    return () => {
      unsubscribeShow();
      unsubscribeClear();
    };
  }, [globalBus]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    globalBus.publish('error:clear', undefined);
  }, [globalBus]);

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.margin = '';
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) {
      loadPreferences();
    }
  }, [preferencesLoaded, loadPreferences]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleChange = () => {
      logFullscreenState('event:change');
      const active = Boolean(getFullscreenElement());
      setPreference('fullscreenEnabled', active);
    };
    const handleError = (event: Event) => console.warn('[fullscreen] error event', event);

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('fullscreenerror', handleError);

    logFullscreenState('mount');

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('fullscreenerror', handleError);
    };
  }, [setPreference]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    if (typeof document === 'undefined') return;

    const current = getFullscreenElement();

    if (!fullscreenEnabled && current) {
      void exitFullscreen(undefined, 'fullscreen-disabled');
    }

    if (fullscreenEnabled && !current) {
      console.info('[fullscreen] waiting for user gesture to enter fullscreen');
    }
  }, [fullscreenEnabled, preferencesLoaded, scene]);

  useEffect(() => {
    if (scene !== 'game') return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setSettingsOpen(true);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scene]);

  const handleCreateGame = useCallback(
    async (name: string) => {
      if (fullscreenEnabled && typeof document !== 'undefined' && !getFullscreenElement()) {
        await requestFullscreen(document.documentElement, 'lobby-create');
      }

      // Open manager selection first
      setPlayerName(name);
      setManagerOpen(true);
    },
    [changeScene, createGame, fullscreenEnabled, globalBus]
  );

  const handleManagerSelect = useCallback(
    async (manager: 'hasty' | 'fast' | 'smart') => {
      setSelectedManager(manager);
      setManagerOpen(false);
      try {
        await createGame(playerName);
        changeScene('startLobby');
      } catch (error) {
        console.error(error);
        globalBus.publish('error:show', {
          message: '호스트 세션을 시작하지 못했습니다. 콘솔 로그를 확인해 주세요.',
          context: 'create-game',
          cause: error
        });
      }
    },
    [changeScene, createGame, globalBus, playerName]
  );

  const handleJoinGame = useCallback(
    async (name: string, code: string) => {
      if (fullscreenEnabled && typeof document !== 'undefined' && !getFullscreenElement()) {
        await requestFullscreen(document.documentElement, 'lobby-join');
      }

      try {
        await joinGame(name, code);
        setPlayerName(name);
        changeScene('startLobby');
      } catch (error) {
        console.error(error);
        globalBus.publish('error:show', {
          message: '접속에 실패했습니다. 합류 코드를 확인하고 다시 시도해 주세요.',
          context: 'join-game',
          cause: error
        });
      }
    },
    [changeScene, fullscreenEnabled, globalBus, joinGame]
  );

  const handleLeave = useCallback(() => {
    leaveSession();
    changeScene('mainLobby');
    setSettingsOpen(false);
    setOptionsOpen(false);
    setDeveloperOpen(false);
    dismissError();
  }, [changeScene, dismissError, leaveSession]);

  const startMission = useCallback(() => {
    if (!startMissionReady) return;

    if (fullscreenEnabled && typeof document !== 'undefined') {
      const current = getFullscreenElement();
      if (!current) {
        void requestFullscreen(document.documentElement, 'start-mission');
      }
    }

    changeScene('game');
    setSettingsOpen(false);
  }, [changeScene, fullscreenEnabled, startMissionReady]);

  const handleOptionsClose = useCallback(() => {
    dismissError();
    setOptionsOpen(false);
  }, [dismissError]);

  // 세션이 끊기면(예: 호스트/게스트 연결 타임아웃) 자동으로 메인 로비로 복귀
  useEffect(() => {
    if (!sessionMeta && (scene === 'startLobby' || scene === 'game')) {
      changeScene('mainLobby');
      setSettingsOpen(false);
      setOptionsOpen(false);
      setDeveloperOpen(false);
    }
  }, [changeScene, scene, sessionMeta]);

  const handleManualAnswer = useCallback(
    async (code: string) => {
      if (!sessionMeta || sessionMeta.mode !== 'host') return;
      try {
        await sessionMeta.session.acceptAnswer(code);
      } catch (error) {
        console.error(error);
        globalBus.publish('error:show', {
          message: '응답 코드를 적용하지 못했습니다. 코드가 맞는지 확인해 주세요.',
          context: 'manual-answer',
          cause: error
        });
      }
    },
    [globalBus, sessionMeta]
  );

  const content = useMemo(() => {
    if (scene === 'mainLobby') {
      return (
        <GameLobby
          playerName={playerName}
          onNameChange={setPlayerName}
          onCreate={handleCreateGame}
          onJoin={handleJoinGame}
          onOptions={() => setOptionsOpen(true)}
          onAbout={() => setDeveloperOpen(true)}
          background="/assets/bg/lobby.gif"
        />
      );
    }

    if (scene === 'startLobby' && sessionMeta) {
      const signalSessionId = (sessionMeta as { signalSessionId?: string | null }).signalSessionId ?? null;
      const autoConnect = Boolean(signalSessionId);
      const sessionReady = Boolean(signalSessionId);
      const answerCode = sessionMeta.mode === 'guest' && !autoConnect ? sessionMeta.answerCode : undefined;
      const acceptAnswer =
        sessionMeta.mode === 'host' && !autoConnect ? handleManualAnswer : undefined;

      return (
        <GameStartLobby
          background="/assets/bg/lobby.gif"
          mode={sessionMeta.mode}
          lobbyCode={sessionMeta.code}
          answerCode={answerCode}
          participants={participants}
          localParticipantId={localParticipantId}
          canSendChat={canSendChat}
          channelReady={channelOpen}
          sessionReady={sessionReady}
          chatMessages={chatMessages}
          onToggleReady={toggleReady}
          onStartGame={startMission}
          onLeave={handleLeave}
          onAcceptAnswer={acceptAnswer}
          autoConnect={autoConnect}
          onOptions={() => setOptionsOpen(true)}
          onSendChat={sendChatMessage}
          llmManager={selectedManager}
          publishLobbyMessage={publishLobbyMessage}
          registerLobbyHandler={registerLobbyHandler}
          probeChannel={probeChannel}
        />
      );
    }

    return (
      <StageViewport background="/assets/bg/stage-ops.png" className="cursor-crosshair">
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto mx-6 mt-6 flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Greyfall Stage</p>
              <h1 className="text-2xl font-semibold">Lantern Circle Operations Console</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex gap-4 text-sm font-semibold">
                <span className="text-primary">Glow {resources.glow}</span>
                <span className="text-destructive">Corruption {resources.corruption}</span>
              </div>
              <button
                type="button"
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
                onClick={() => setOptionsOpen(true)}
              >
                Options
              </button>
              <ControlDock />
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-6 left-6 flex w-[360px] flex-col gap-4">
            <ChatDock />
            <CommandConsole />
          </div>

          {scene === 'game' && (
            <div className="pointer-events-auto absolute bottom-6 right-6 w-[360px]">
              <FieldGraph
                localParticipantId={localParticipantId}
                participants={participants}
                publish={publishLobbyMessage}
              />
            </div>
          )}
        </div>

        {scene === 'game' && (
          <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        )}
      </StageViewport>
    );
  }, [
    handleCreateGame,
    handleJoinGame,
    handleLeave,
    sessionMeta,
    handleManualAnswer,
    localParticipantId,
    chatMessages,
    participants,
    playerName,
    canSendChat,
    resources.corruption,
    resources.glow,
    scene,
    settingsOpen,
    startMission,
    toggleReady,
    sendChatMessage,
    selectedManager,
    publishLobbyMessage,
    registerLobbyHandler
  ]);

  const leaveSessionRef = useRef(leaveSession);
  useEffect(() => {
    leaveSessionRef.current = leaveSession;
  }, [leaveSession]);

  useEffect(() => () => {
    leaveSessionRef.current();
  }, []);

  return (
    <>
      {content}
      <OptionsDialog
        open={optionsOpen}
        onClose={handleOptionsClose}
        scene={scene}
        onEnableMusic={resumeMusic}
        onPreviewMusicVolume={previewMusicVolume}
      />
      <DeveloperDialog open={developerOpen} onClose={() => setDeveloperOpen(false)} />
      <ManagerSelectDialog
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onSelect={handleManagerSelect}
      />
      <ErrorDialog open={Boolean(errorMessage)} message={errorMessage ?? ''} onClose={dismissError} />
    </>
  );
}

export default App;

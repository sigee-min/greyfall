import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StageViewport } from './stage/stage-bridge';
import { ChatDock } from './ui/chat/chat-dock';
import { CommandConsole } from './ui/cards/command-console';
import { ControlDock } from './ui/controls/control-dock';
import { SettingsOverlay } from './ui/settings/settings-overlay';
import { OptionsDialog } from './ui/dialogs/options-dialog';
import { DeveloperDialog } from './ui/dialogs/developer-dialog';
import { NetworkMonitorDialog } from './ui/dialogs/network-monitor-dialog';
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
import { useWorldMedia } from './domain/world/use-world-media';
import { FieldGraph } from './ui/world/field-graph';
import { MapMini } from './ui/world/map-mini';
import { InteractionPanel } from './ui/world/interaction-panel';
import { EquipmentHudBadge } from './ui/hud/equipment-hud-badge';
import { CharacterBuilder } from './ui/character/character-builder';
import { EquipmentPanel } from './ui/character/equipment-panel';
import { useCharacterStore } from './store/character';
import { Toaster } from './ui/common/toaster';
import { useI18n } from './i18n';
import { setToolsProviders } from './llm/tools/providers';
import { LlmMonitor } from './ui/dev/llm-monitor';
import { useAssetPreload } from './domain/assets/use-asset-preload';
import { missionStateSync } from './domain/mission/mission-sync';
import { useMissionStore } from './domain/mission/state';
import { getAuthUser, setAuthUser, clearAuthUser, type AuthUser } from './lib/auth';
import { getMeDedup, getUsersMeDedup } from './lib/auth-session';
import { LoginGate } from './ui/auth/login-gate';

const LOBBY_TRACKS: string[] = ['/assets/audio/lobby/main-theme.wav', '/assets/audio/lobby/main-theme.mp3'];

function App({ hasGoogleClient = false }: { hasGoogleClient?: boolean }) {
  const { t } = useI18n();
  useUiSfx();
  useCustomCursor();
  useDisableAutofill();
  useAssetPreload();

  const resources = useGreyfallStore(selectResources);
  const [scene, setScene] = useState<SceneKey>('mainLobby');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [netmonOpen, setNetmonOpen] = useState(false);
  const [llmMonitorOpen, setLlmMonitorOpen] = useState(false);
  const [authUser, setAuthUserState] = useState<AuthUser | null>(() => getAuthUser());
  // Manager selection UI removed; default manager handled inside loaders/components
  const [playerName, setPlayerName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const preferencesLoaded = usePreferencesStore(selectPreferencesLoaded);
  const fullscreenEnabled = usePreferencesStore(selectFullscreenEnabled);
  const debugPageEnabled = usePreferencesStore((s) => s.debugPageEnabled);
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
  const _missionState = useMissionStore((s) => s.state);
  // Dynamic world media (bg/music) in game scene
  const worldMedia = useWorldMedia(localParticipantId);
  const activeTracks = scene === 'game' ? worldMedia.tracks : LOBBY_TRACKS;
  const { resume: resumeMusic, previewVolume: previewMusicVolume } = useBackgroundMusic(
    activeTracks,
    musicPlayEnabled,
    musicVolume,
    scene,
    LOBBY_TRACKS
  );

  const characterBuilt = useCharacterStore((s) => s.built);
  const [showCharBuilder, setShowCharBuilder] = useState(false);
  useEffect(() => {
    if (scene === 'game' && !characterBuilt) setShowCharBuilder(true);
  }, [characterBuilt, scene]);

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

  // Remote mission start → transition for all clients
  useEffect(() => {
    const unsub = registerLobbyHandler('mission:start', () => {
      try {
        if (fullscreenEnabled && typeof document !== 'undefined') {
          const current = getFullscreenElement();
          if (!current) void requestFullscreen(document.documentElement, 'mission-start-remote');
        }
      } catch {}
      if (scene !== 'game') changeScene('game');
      setSettingsOpen(false);
      if (sessionMeta?.mode === 'host') {
        missionStateSync.host.set({ state: 'combat', since: Date.now(), version: 1 }, 'mission:state:combat');
      }
    });
    return unsub;
  }, [changeScene, fullscreenEnabled, registerLobbyHandler, scene, sessionMeta?.mode]);

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
    // Validate server session and sync local auth state
    const validateSession = async () => {
      const json = await getMeDedup(false);
      if (!json.ok || !json.user?.sub) {
        clearAuthUser();
        setAuthUserState(null);
        return;
      }
      setAuthUser(json.user);
      setAuthUserState(json.user);
    };
    void validateSession();
  }, []);

  // When authenticated, fetch server-side profile to initialise callsign/playerName
  useEffect(() => {
    if (!authUser) return;
    if (playerName && playerName.trim().length > 0) return;
    let cancelled = false;
    const loadProfile = async () => {
      const json = await getUsersMeDedup();
      if (!cancelled && json?.ok && json.user?.name) {
        setPlayerName(json.user.name);
      }
    };
    void loadProfile();
    return () => { cancelled = true; };
  }, [authUser, playerName]);

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

  // Backquote(`) → 네트워크 / LLM 모니터 토글 (디버그 허용 시)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isBackquote = event.code === 'Backquote' || event.key === '`';
      if (!isBackquote) return;
      if (!debugPageEnabled) return;
      if (event.ctrlKey) {
        event.preventDefault();
        setLlmMonitorOpen((v) => !v);
        return;
      }
      event.preventDefault();
      setNetmonOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [debugPageEnabled]);

  useEffect(() => {
    if (!debugPageEnabled && llmMonitorOpen) {
      setLlmMonitorOpen(false);
    }
  }, [debugPageEnabled, llmMonitorOpen]);

  const handleCreateGame = useCallback(
    async (name: string) => {
      if (fullscreenEnabled && typeof document !== 'undefined' && !getFullscreenElement()) {
        await requestFullscreen(document.documentElement, 'lobby-create');
      }

      // 바로 세션을 생성하고 시작 로비로 진입
      setPlayerName(name);
      try {
        await createGame(name);
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
    [changeScene, createGame, fullscreenEnabled, globalBus]
  );

  // 모델/매니저 선택 절차 제거로 관련 핸들러 삭제됨

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
    if (sessionMeta?.mode === 'host') {
      missionStateSync.host.set({ state: 'safe', since: Date.now(), version: 1 }, 'mission:state:safe');
    }
  }, [changeScene, dismissError, leaveSession, sessionMeta?.mode]);

  const startMission = useCallback(() => {
    if (!startMissionReady) return;

    // Broadcast mission start to guests; host also echoes locally via lobbyBus
    try {
      publishLobbyMessage('mission:start', {}, 'mission-start');
    } catch {}

    if (fullscreenEnabled && typeof document !== 'undefined') {
      const current = getFullscreenElement();
      if (!current) {
        void requestFullscreen(document.documentElement, 'start-mission');
      }
    }

    // Try to resume background music on user action
    try { resumeMusic('start-mission'); } catch {}

    if (scene !== 'game') changeScene('game');
    setSettingsOpen(false);
    if (sessionMeta?.mode === 'host') {
      missionStateSync.host.set({ state: 'combat', since: Date.now(), version: 1 }, 'mission:state:combat');
    }
  }, [changeScene, fullscreenEnabled, publishLobbyMessage, resumeMusic, scene, startMissionReady, sessionMeta?.mode]);

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
      // Ensure mission state resets to safe when session ends (host only)
      missionStateSync.host.set({ state: 'safe', since: Date.now(), version: 1 }, 'mission:state:safe');
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
          background="/assets/bg/theme.png"
        />
      );
    }

    if (scene === 'startLobby' && sessionMeta) {
      const signalSessionId = (sessionMeta as { signalSessionId?: string | null }).signalSessionId ?? null;
      const autoConnect = Boolean(signalSessionId);
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
          chatMessages={chatMessages}
          onToggleReady={toggleReady}
          onStartGame={startMission}
          onLeave={handleLeave}
          onAcceptAnswer={acceptAnswer}
          autoConnect={autoConnect}
          onOptions={() => setOptionsOpen(true)}
          onSendChat={sendChatMessage}
          // 매니저는 컴포넌트 내부 기본값 사용 (기본: 'smart')
          publishLobbyMessage={publishLobbyMessage}
          
          probeChannel={probeChannel}
        />
      );
    }

    const stageBg = scene === 'game' ? worldMedia.bgSrc : '/assets/bg/stage-ops.png';
    return (
      <StageViewport
        background={stageBg}
        className="cursor-crosshair"
        localParticipantId={localParticipantId}
        publishLobbyMessage={publishLobbyMessage}
        registerLobbyHandler={registerLobbyHandler}
      >
        <div className="pointer-events-none absolute inset-0">
          <Toaster />
          {/* Global toasts */}
          <div className="pointer-events-none">
            {/* Toaster overlays inside stage for z-index consistency */}
          </div>
          <div className="pointer-events-auto mx-6 mt-6 flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{t('stage.brand')}</p>
              <h1 className="text-2xl font-semibold">{t('lobby.title.line1')} {t('lobby.title.line2')}</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex gap-4 text-sm font-semibold">
                <span className="text-primary">{t('resources.glow')} {resources.glow}</span>
                <span className="text-destructive">{t('resources.corruption')} {resources.corruption}</span>
              </div>
              <EquipmentHudBadge actorId={localParticipantId} />
              <button
                type="button"
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
                onClick={() => setOptionsOpen(true)}
              >
                {t('common.options')}
              </button>
              <ControlDock />
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-6 left-6 flex w-[360px] flex-col gap-4">
            <ChatDock />
            <CommandConsole publish={publishLobbyMessage} localParticipantId={localParticipantId} />
            <EquipmentPanel actorId={localParticipantId} publish={publishLobbyMessage} />
          </div>

          {scene === 'game' && (
            <>
              <div className="pointer-events-auto absolute bottom-6 right-6 w-[360px]">
                <FieldGraph
                  localParticipantId={localParticipantId}
                  publish={publishLobbyMessage}
                />
                <div className="mt-4" />
                <MapMini
                  localParticipantId={localParticipantId}
                  participants={participants}
                  publish={publishLobbyMessage}
                  register={registerLobbyHandler}
                />
              </div>
              <div className="pointer-events-auto absolute bottom-6 left-6 w-[360px]">
                <InteractionPanel
                  localParticipantId={localParticipantId}
                  participants={participants}
                  publish={publishLobbyMessage}
                  register={registerLobbyHandler}
                />
              </div>
            </>
          )}
        </div>

        {scene === 'game' && (
          <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        )}

        {scene === 'game' && showCharBuilder && (
          <CharacterBuilder
            onClose={() => setShowCharBuilder(false)}
            playerName={playerName}
            localParticipantId={localParticipantId}
            publish={publishLobbyMessage}
          />)
        }
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
    publishLobbyMessage,
    registerLobbyHandler,
    channelOpen,
    probeChannel,
    showCharBuilder,
    t,
    worldMedia.bgSrc
  ]);

  const leaveSessionRef = useRef(leaveSession);
  useEffect(() => {
    leaveSessionRef.current = leaveSession;
  }, [leaveSession]);

  useEffect(() => () => {
    leaveSessionRef.current();
  }, []);

  // Wire tools providers (e.g., chat.history) with latest chat log
  useEffect(() => {
    setToolsProviders({
      getChatHistory: async (limit: number, _includeSystem?: boolean) => {
        const lim = Math.max(1, Math.min(10, Number(limit) || 10));
        const slice = chatMessages.slice(-lim);
        return slice.map((m) => ({
          author: m.authorName,
          role: m.authorId?.startsWith('ai:') ? 'assistant' : 'user',
          body: m.body,
          at: m.at
        }));
      }
    });
  }, [chatMessages]);

  return (
    <>
      {content}
      {scene === 'mainLobby' && !authUser && hasGoogleClient && (
        <LoginGate onSignedIn={(u) => setAuthUserState(u)} />
      )}
      <OptionsDialog
        open={optionsOpen}
        onClose={handleOptionsClose}
        scene={scene}
        onEnableMusic={resumeMusic}
        onPreviewMusicVolume={previewMusicVolume}
      />
      <DeveloperDialog open={developerOpen} onClose={() => setDeveloperOpen(false)} />
      <NetworkMonitorDialog open={netmonOpen} onClose={() => setNetmonOpen(false)} />
      {debugPageEnabled && llmMonitorOpen && <LlmMonitor onClose={() => setLlmMonitorOpen(false)} />}
      {/* 매니저 선택 다이얼로그 제거됨 */}
      <ErrorDialog open={Boolean(errorMessage)} message={errorMessage ?? ''} onClose={dismissError} />
    </>
  );
}

export default App;

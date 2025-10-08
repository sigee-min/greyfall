import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { SessionParticipant, SessionRole } from '../domain/session/types';
import type { SessionChatLogEntry } from '../domain/chat/types';
import type { LlmManagerKind } from '../llm/llm-engine';
import { useGuideLoader } from '../domain/llm/use-guide-loader';
import { executeAICommand } from '../domain/ai/ai-router';
import { requestAICommand } from '../domain/ai/ai-gateway';
import { loadEngineByManager, ensureChatApiReady } from '../llm/llm-engine';
import { subscribeProgress, getLastProgress } from '../llm/progress-bus';
import type { LobbyMessageBodies, LobbyMessageKind } from '../protocol';
import { getStartLobbyLayout } from '../ui/layouts/start-lobby';
import { CharacterBuilder } from '../ui/character/character-builder';
import { ConfirmDialog } from '../ui/dialogs/confirm-dialog';
import { useI18n } from '../i18n';
import { useAspectCategory } from '../ui/layouts/use-aspect-category';

type GameStartLobbyProps = {
  background: string;
  mode: SessionRole;
  lobbyCode: string;
  answerCode?: string;
  participants: SessionParticipant[];
  localParticipantId: string | null;
  chatMessages: SessionChatLogEntry[];
  channelReady?: boolean;
  canSendChat: boolean;
  onToggleReady: (participantId: string) => void;
  onStartGame: () => void;
  onLeave: () => void;
  onAcceptAnswer?: (answerCode: string) => void;
  onOptions?: () => void;
  autoConnect?: boolean;
  onSendChat: (body: string) => boolean;
  llmManager?: LlmManagerKind;
  publishLobbyMessage: <K extends LobbyMessageKind>(
    kind: K,
    body: LobbyMessageBodies[K],
    context?: string
  ) => boolean;
  probeChannel: () => boolean;
};

export function GameStartLobby({
  background,
  mode,
  lobbyCode,
  answerCode,
  participants,
  localParticipantId,
  chatMessages,
  canSendChat,
  channelReady = false,
  onToggleReady,
  onStartGame,
  onLeave,
  onAcceptAnswer,
  onOptions,
  autoConnect = false,
  onSendChat,
  llmManager = 'smart',
  publishLobbyMessage,
  probeChannel
}: GameStartLobbyProps) {
  const { t } = useI18n();
  const [answerInput, setAnswerInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const { ready: llmReady } = useGuideLoader({
    manager: llmManager,
    enabled: mode === 'host'
  });
  const everyoneReady = participants.length > 0 && participants.every((participant) => participant.ready);
  const localParticipant = participants.find((participant) => participant.id === localParticipantId);
  const playerName = localParticipant?.name ?? 'Player';
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const [llmPrewarmText, setLlmPrewarmText] = useState<string | null>(null);
  const [llmPrewarmPct, setLlmPrewarmPct] = useState<number | null>(null);
  const guideAnnouncedRef = useRef(false);
  const prewarmedRef = useRef(false);

  // Character builder + confirm flow
  const [charBuilderOpen, setCharBuilderOpen] = useState(false);
  const [wasReadyWhenOpened, setWasReadyWhenOpened] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStats, setConfirmStats] = useState<string>('');
  const [confirmTraits, setConfirmTraits] = useState<string>('');
  const [confirmPassives, setConfirmPassives] = useState<string>('');
  const pendingProceedRef = useRef<(() => void) | null>(null);

  const handleOpenCharacterBuilder = useCallback(() => {
    setWasReadyWhenOpened(Boolean(localParticipant?.ready));
    setCharBuilderOpen(true);
  }, [localParticipant?.ready]);

  const submitChat = useCallback(() => {
    if (!canSendChat) return false;
    if (!chatInput.trim()) return false;
    const sent = onSendChat(chatInput);
    if (sent) {
      setChatInput('');
    }
    return sent;
  }, [canSendChat, chatInput, onSendChat]);

  const handleAnswerSubmit = useCallback(
    (value: string) => {
      if (!onAcceptAnswer) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      onAcceptAnswer(trimmed);
      setAnswerInput('');
    },
    [onAcceptAnswer]
  );

  const handleChatSubmit = useCallback(() => {
    submitChat();
  }, [submitChat]);

  const handleChatOpen = useCallback(() => {
    setChatOpen(true);
    if (channelReady) return;
    try {
      const ok = probeChannel();
      if (!ok) console.debug('[chat] probeChannel: channel not open');
    } catch (error) {
      console.debug('[chat] probeChannel failed', error);
    }
  }, [channelReady, probeChannel]);

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
  }, []);

  const handleChatKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      const native = event.nativeEvent as unknown as { isComposing?: boolean };
      if (native?.isComposing) return;
      event.preventDefault();
      submitChat();
    },
    [submitChat]
  );

  useEffect(() => {
    if (!chatOpen) return;
    if (!chatListRef.current) return;
    chatListRef.current.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    if (mode !== 'host') return;
    if (!llmReady) return;
    if (!localParticipantId) return;
    if (guideAnnouncedRef.current) return;

    guideAnnouncedRef.current = true;

    void (async () => {
      const parsed = await requestAICommand({
        manager: llmManager,
        requestType: 'chat',
        actorId: localParticipantId ?? 'host',
        persona: '너는 Greyfall Ready Room을 운영하는 심판자이다. 한국어로만 격려의 말을 건넨다.',
        userInstruction: '랜턴 팀에게 임무 준비가 시작되었음을 알리고, 함께 준비하자는 인사를 건네라.',
        temperature: 0.5,
        maxTokens: 192,
        fallbackChatText: '채널에 합류했습니다.',
        timeoutMs: 45000
      });
      await executeAICommand(parsed, {
        manager: llmManager,
        publishLobbyMessage,
        participants,
        localParticipantId
      });
    })();
  }, [llmReady, llmManager, localParticipantId, mode, participants, publishLobbyMessage]);

  useEffect(() => {
    if (mode !== 'host') return;
    if (prewarmedRef.current) return;
    prewarmedRef.current = true;
    void (async () => {
      try {
        const last = getLastProgress();
        if (last?.text) setLlmPrewarmText(last.text === 'ready' ? '세팅 완료' : String(last.text));
        if (typeof last?.progress === 'number') {
          const pct = Math.round(Math.max(0, Math.min(1, last.progress)) * 100);
          setLlmPrewarmPct(pct >= 100 ? null : pct);
        }
        const unsub = subscribeProgress((report) => {
          if (typeof report.progress === 'number') {
            const pct = Math.round(Math.max(0, Math.min(1, report.progress)) * 100);
            setLlmPrewarmPct(pct >= 100 ? null : pct);
          }
          if (report.text) {
            const raw = String(report.text || '');
            setLlmPrewarmText(raw === 'ready' ? '세팅 완료' : raw);
          }
        });

        await loadEngineByManager(llmManager);
        await ensureChatApiReady(llmManager, 180_000);
        setLlmPrewarmPct(null);
        setLlmPrewarmText('세팅 완료');
        unsub();
      } catch (error) {
        console.warn('[llm] prewarm failed', error);
        setLlmPrewarmText('로컬 LLM 준비에 실패했어요. 나중에 다시 시도해 주세요.');
      }
    })();
  }, [mode, llmManager]);

  const prewarmComplete = useMemo(() => {
    if (mode !== 'host') return true;
    if (llmPrewarmPct !== null && llmPrewarmPct >= 100) return true;
    if (llmPrewarmText && llmPrewarmText.includes('세팅 완료')) return true;
    return false;
  }, [llmPrewarmPct, llmPrewarmText, mode]);

  const canStartMission = useMemo(
    () => (mode === 'host' ? everyoneReady && llmReady && prewarmComplete : everyoneReady),
    [everyoneReady, llmReady, mode, prewarmComplete]
  );

  useEffect(() => {
    if (!chatOpen) return;
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setChatOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [chatOpen]);

  const aspectCategory = useAspectCategory();
  const LayoutComponent = useMemo(() => getStartLobbyLayout(aspectCategory), [aspectCategory]);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
          Initialising ready room…
        </div>
      }
    >
      <LayoutComponent
        background={background}
        mode={mode}
        lobbyCode={lobbyCode}
        answerCode={answerCode}
        autoConnect={autoConnect}
        participants={participants}
        localParticipantId={localParticipantId}
        localParticipant={localParticipant}
        channelReady={channelReady}
        canSendChat={canSendChat}
        chatMessages={chatMessages}
        chatInput={chatInput}
        answerInput={answerInput}
        chatOpen={chatOpen}
        canStartMission={canStartMission}
        llmPrewarmPct={llmPrewarmPct}
        llmPrewarmText={llmPrewarmText}
        onOptions={onOptions}
        onLeave={onLeave}
        onStartGame={onStartGame}
        onToggleReady={onToggleReady}
        onOpenCharacterBuilder={handleOpenCharacterBuilder}
        onAnswerInputChange={setAnswerInput}
        onAnswerSubmit={onAcceptAnswer ? handleAnswerSubmit : undefined}
        onChatInputChange={setChatInput}
        onChatSubmit={handleChatSubmit}
        onChatOpen={handleChatOpen}
        onChatClose={handleChatClose}
        onChatKeyDown={handleChatKeyDown}
        chatListRef={chatListRef}
      />

      {charBuilderOpen && (
        <CharacterBuilder
          onClose={() => setCharBuilderOpen(false)}
          playerName={playerName}
          localParticipantId={localParticipantId}
          publish={publishLobbyMessage}
          onBeforeFinalize={({ summary, proceed }) => {
            const statsLine = Object.entries(summary.stats)
              .map(([k, v]) => `${k}:${v}`)
              .join(', ');
            const traitNames = summary.traits.map((t) => t.name).join(', ') || '—';
            const passiveNames = summary.passives.map((p) => p.name).join(', ') || '—';
            setConfirmStats(statsLine);
            setConfirmTraits(traitNames);
            setConfirmPassives(passiveNames);
            pendingProceedRef.current = () => {
              proceed();
              // After character is finalised and sent, set ready if it was not ready
              if (!wasReadyWhenOpened && localParticipantId) {
                onToggleReady(localParticipantId);
              }
              pendingProceedRef.current = null;
              setConfirmOpen(false);
            };
            setConfirmOpen(true);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('char.confirm.title')}
        message={t('char.confirm.desc')}
        confirmText={t('char.confirm.approve')}
        cancelText={t('common.cancel')}
        onConfirm={() => pendingProceedRef.current?.()}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="space-y-2 text-xs">
          <div>
            <span className="font-semibold">{t('char.stats')}:</span> {confirmStats || '—'}
          </div>
          <div>
            <span className="font-semibold">{t('char.traits')}:</span> {confirmTraits || '—'}
          </div>
          <div>
            <span className="font-semibold">{t('char.passives')}:</span> {confirmPassives || '—'}
          </div>
        </div>
      </ConfirmDialog>
    </Suspense>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';
import { FallbackBackground } from '../ui/common/fallback-bg';
import type { SessionParticipant, SessionRole } from '../domain/session/types';
import type { SessionChatLogEntry } from '../domain/chat/types';
import type { LlmManagerKind } from '../llm/llm-engine';
import { useGuideLoader } from '../domain/llm/use-guide-loader';
// LLM progress UI/bridge removed
// LLM config broadcast removed
import { executeAICommand } from '../domain/ai/ai-router';
import { requestAICommand } from '../domain/ai/ai-gateway';
import { loadEngineByManager, ensureChatApiReady } from '../llm/llm-engine';
import { subscribeProgress, getLastProgress } from '../llm/progress-bus';
import type { LobbyMessageBodies, LobbyMessageKind } from '../protocol';
import { useResponsive } from '../ui/responsive/use-responsive';
import { ActionBar } from '../ui/responsive/action-bar';

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
  const { isMobile } = useResponsive();
  const [answerInput, setAnswerInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const { ready: llmReady } = useGuideLoader({
    manager: llmManager,
    enabled: mode === 'host'
  });
  const everyoneReady = participants.length > 0 && participants.every((participant) => participant.ready);
  const localParticipant = participants.find((participant) => participant.id === localParticipantId);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  // LLM prewarm local progress for Start Mission button area
  const [llmPrewarmText, setLlmPrewarmText] = useState<string | null>(null);
  const [llmPrewarmPct, setLlmPrewarmPct] = useState<number | null>(null);
  // 진행률 UI 제거됨
  const guideAnnouncedRef = useRef(false);
  const prewarmedRef = useRef(false);

  const submitChat = useCallback(() => {
    if (!canSendChat) return false;
    if (!chatInput.trim()) return false;
    const sent = onSendChat(chatInput);
    if (sent) {
      setChatInput('');
    }
    return sent;
  }, [canSendChat, chatInput, onSendChat]);

  useEffect(() => {
    if (!chatOpen) return;
    if (!chatListRef.current) return;
    chatListRef.current.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatOpen]);

  // 자동 채팅 오픈 기능 제거됨 (사용자 수동으로 열도록 유지)

  // Host progress bus removed

  // elapsed time tracking no longer used for auto-stall warnings/retries

  // Host broadcasts progress; guests subscribe and display
  // LLM progress broadcast removed


  // (moved earlier) Preset defaulting now runs before engine load

  // LLM config broadcast removed

  // displayStatus/uiProgressPercent 사용 제거

  // 심판자 로드 완료 시, AI 명령(chat)으로 1회 합류 알림 전송 (폴링 제거)
  useEffect(() => {
    if (mode !== 'host') return;
    if (!llmReady) return;
    if (!localParticipantId) return;
    if (guideAnnouncedRef.current) return;

    guideAnnouncedRef.current = true;

    void (async () => {
      const parsed = await requestAICommand({
        manager: llmManager,
        userInstruction:
          '팀에 시작 인사를 전하세요. 반드시 JSON 한 줄로 {"cmd","body"}만 출력하세요. chat은 string 고정.',
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

  // Host-only prewarm: proactively load/prepare local LLM on lobby entry
  useEffect(() => {
    if (mode !== 'host') return;
    if (prewarmedRef.current) return;
    prewarmedRef.current = true;
    void (async () => {
      try {
        // subscribe engine progress bus
        const last = getLastProgress();
        if (last?.text) setLlmPrewarmText(last.text === 'ready' ? '세팅 완료' : String(last.text));
        if (typeof last?.progress === 'number') setLlmPrewarmPct(Math.round(Math.max(0, Math.min(1, last.progress)) * 100));
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
        // 준비 완료 후에도 텍스트는 잠시 유지
        setLlmPrewarmPct(null);
        setLlmPrewarmText((prev) => (prev && prev !== '세팅 완료' ? '세팅 완료' : prev || '세팅 완료'));
        unsub();
      } catch (e) {
        console.warn('[llm] prewarm failed', e);
        setLlmPrewarmText('로컬 LLM 준비에 실패했어요. 나중에 다시 시도해 주세요.');
      }
    })();
  }, [mode, llmManager]);

  // 모든 인원 준비 + (호스트인 경우) 심판자까지 준비되어야 시작 가능
  const canStartMission = useMemo(
    () => (mode === 'host' ? everyoneReady && llmReady : everyoneReady),
    [everyoneReady, llmReady, mode]
  );

  useEffect(() => {
    if (!chatOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [chatOpen]);

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitChat();
  };

  const chatPlaceholder = useMemo(() => t('ready.chat.placeholder'), [t]);

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-slate-950 text-foreground">
      <FallbackBackground src={background} />
      <div className="absolute inset-0 bg-slate-950/40" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex-1 py-10">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-10 px-5 sm:px-7 lg:px-12">
            <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2 lg:max-w-3xl">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/80">{t('ready.brand')}</p>
                <h2 className="text-3xl font-semibold lg:text-4xl xl:text-5xl">{mode === 'host' ? t('ready.header.host') : t('ready.header.guest')}</h2>
                <p className="max-w-prose text-sm text-muted-foreground lg:text-base">{t('ready.description')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  if (!channelReady) {
                    try {
                      const ok = probeChannel();
                      if (!ok) console.debug('[chat] probeChannel: channel not open');
                    } catch (err) {
                      console.debug('[chat] probeChannel failed', err);
                    }
                  }
                }}
                className="rounded-md border border-primary/60 px-3 py-2 text-primary transition hover:bg-primary/10"
              >
                {t('ready.chat.open')}
              </button>
                {onOptions && (
                  <button type="button" onClick={onOptions} className="rounded-md border border-border/60 px-3 py-2 transition hover:border-primary hover:text-primary">
                    {t('common.options')}
                  </button>
                )}
                <button type="button" onClick={onLeave} className="rounded-md border border-border/60 px-3 py-2 transition hover:border-destructive hover:text-destructive">
                  {t('ready.leave')}
                </button>
              </div>
            </header>
            

            <section className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr),minmax(380px,460px)]">
              <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{t('ready.crewStatus')}</h3>
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{participants.length}명 연결</span>
                </div>
                <ul className="mt-5 space-y-4 text-sm">
                  {participants.map((participant) => {
                    const isReady = participant.ready;
                    return (
                      <li
                        key={participant.id}
                        className={cn(
                          'grid gap-4 rounded-xl border border-border/60 bg-background/75 px-5 py-4 shadow-sm transition',
                          'sm:grid-cols-[auto,1fr,auto]',
                          isReady ? 'border-primary/70 ring-1 ring-primary/30' : undefined
                        )}
                      >
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold uppercase tracking-[0.25em]', participant.role === 'host' ? 'border-primary/70 text-primary' : 'border-border/60 text-muted-foreground')}>
                          {participant.role === 'host' ? 'HOST' : 'GUEST'}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {participant.name}{' '}
                            <span className="text-xs text-muted-foreground">{participant.tag}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {participant.isSelf ? '나 (You)' : participant.role === 'host' ? '세션 관리자' : '접속자'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'self-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]',
                            isReady ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isReady ? t('ready.status.ready') : t('ready.status.standby')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {participants.length === 0 && (
                  <p className="mt-6 rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    {t('ready.noParticipants')}
                  </p>
                )}
              </article>

              <div className="flex flex-col gap-6 text-sm">
                <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                  <header className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      {mode === 'host' ? t('ready.card.shareJoin') : autoConnect ? t('ready.card.connection') : t('ready.card.returnAnswer')}
                    </h3>
                    {mode === 'host' && (
                      <button
                        type="button"
                        className="rounded-md border border-primary/60 bg-primary/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary-foreground transition hover:bg-primary"
                        onClick={() => {
                          void navigator.clipboard.writeText(lobbyCode).then(
                            () => console.info('[ui] join code copied'),
                            (error) => console.warn('[ui] failed to copy join code', error)
                          );
                        }}
                      >
                        {t('ready.copyCode')}
                      </button>
                    )}
                  </header>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-background/90 px-4 py-4 font-mono text-sm text-primary shadow-inner">
                      {mode === 'host'
                        ? lobbyCode
                        : autoConnect
                          ? t('ready.autoConnect.wait')
                          : answerCode ?? t('ready.answer.generating')}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {mode === 'host'
                        ? autoConnect
                          ? t('ready.host.help')
                          : t('ready.guest.help')
                        : autoConnect
                          ? t('ready.guest.waitHost')
                          : t('ready.guest.copyAnswerHelp')}
                    </p>
                  </div>

                  {mode === 'host' && onAcceptAnswer && !autoConnect && (
                    <div className="mt-5 space-y-3">
                      <label
                        htmlFor="answer-input"
                        className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground"
                      >
                        {t('ready.applyAnswer')}
                      </label>
                      <textarea
                        id="answer-input"
                        value={answerInput}
                        onChange={(event) => setAnswerInput(event.target.value)}
                        placeholder={t('ready.answer.placeholder')}
                        className="h-28 w-full rounded-xl border border-border bg-background/80 px-3 py-3 font-mono text-xs leading-snug outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        autoCapitalize="off"
                      />
                      <button
                        type="button"
                        className="w-full rounded-md border border-primary bg-primary/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground transition hover:bg-primary"
                        onClick={() => {
                          const trimmed = answerInput.trim();
                          if (!trimmed) return;
                          onAcceptAnswer(trimmed);
                          setAnswerInput('');
                        }}
                      >
                        {t('ready.confirmAnswer')}
                      </button>
                    </div>
                  )}

                  {mode === 'guest' && !autoConnect && answerCode && (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
                      onClick={() => {
                        void navigator.clipboard.writeText(answerCode).catch(() => {
                          console.warn('[ui] failed to copy answer code');
                        });
                      }}
                    >
                      {t('ready.copyAnswer')}
                    </button>
                  )}
                </article>

                <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{t('ready.check')}</h3>
                  <div className="mt-4 space-y-3">
                    {localParticipant && (
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition',
                          localParticipant.ready
                            ? 'border-destructive/60 bg-destructive/15 text-destructive hover:bg-destructive/25'
                            : 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                        )}
                        onClick={() => onToggleReady(localParticipant.id)}
                      >
                        {localParticipant.ready ? t('ready.cancel') : t('ready.set')}
                      </button>
                    )}

                    {mode === 'host' && (
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition',
                          canStartMission
                            ? 'border-emerald-400 bg-emerald-500/85 text-emerald-950 hover:bg-emerald-500'
                            : 'border-border bg-background/70 text-muted-foreground'
                        )}
                        disabled={!canStartMission}
                        onClick={() => {
                          if (!canStartMission) return;
                          onStartGame();
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {t('ready.startMission')}
                          {llmPrewarmPct != null && (
                            <span className="flex items-center gap-1 text-[11px] font-normal text-emerald-950/80">
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-emerald-900/60 border-b-transparent" />
                              {llmPrewarmPct}%
                            </span>
                          )}
                        </span>
                      </button>
                    )}

                    {mode === 'host' && llmPrewarmText && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{llmPrewarmText}</p>
                    )}

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      모든 플레이어가 준비 상태여야 임무를 시작할 수 있습니다. 준비가 늦어지는 인원은 채팅으로 다시 확인해 주세요.
                    </p>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>

      </div>

      {/* LLM progress overlay removed */
      }

      {chatOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 z-0"
            data-cursor="pointer"
            aria-hidden="true"
            onClick={() => setChatOpen(false)}
          />
          <div
            className="relative z-10 flex h-full w-full max-w-full flex-col border-l border-border/60 bg-card/95 shadow-2xl transition-transform sm:w-[26rem] sm:rounded-l-2xl lg:w-[30rem]"
            onClick={(event) => event.stopPropagation()}
          >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-md border border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground transition hover:border-primary hover:text-primary"
                onClick={() => setChatOpen(false)}
              >
              {t('common.close')}
              </button>

            <header className="border-b border-border/60 px-5 pb-5 pt-6 pr-16">
              <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">{t('ready.chat.title')}</p>
              <h3 className="text-xl font-semibold text-foreground">{t('ready.chat.subtitle')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                합류 코드와 준비 상황을 공유하세요. 모든 메시지는 데이터 채널을 통해 실시간 전송됩니다.
              </p>
            </header>

            <div ref={chatListRef} className="scrollbar-lobby flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {chatMessages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                  아직 메시지가 없습니다. 채팅이 연결되면 이곳에 기록됩니다.
                </p>
              ) : (
                chatMessages.map((message) => {
                  const timestamp = new Date(message.at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div
                      key={message.id}
                      className={cn('flex flex-col gap-2', message.isSelf ? 'items-end text-right' : 'items-start text-left')}
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5',
                            message.authorRole === 'host'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {message.authorRole === 'host' ? t('ready.chat.host') : t('ready.chat.guest')}
                        </span>
                        <span className="text-xs font-semibold tracking-[0.2em] text-foreground">
                          {message.authorName}{' '}
                          <span className="text-muted-foreground">{message.authorTag}</span>
                        </span>
                        <span>{timestamp}</span>
                      </div>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[70%]',
                          message.isSelf
                            ? 'bg-primary/85 text-primary-foreground'
                            : 'bg-background/85 text-foreground'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="border-t border-border/60 px-5 py-5 space-y-3">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    const native = event.nativeEvent as unknown as { isComposing?: boolean };
                    if (native.isComposing) {
                      return;
                    }
                    event.preventDefault();
                    submitChat();
                  }
                }}
                placeholder={chatPlaceholder}
                className="min-h-[6.5rem] w-full resize-none rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                disabled={!canSendChat}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoCapitalize="off"
              />
              <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{t('ready.chat.hint')}</span>
                <div className="flex items-center gap-2">
                  <span>{t('ready.chat.title')}</span>
                  <button
                    type="submit"
                    className={cn(
                      'rounded-md border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition',
                      canSendChat && chatInput.trim()
                        ? 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                        : 'border-border bg-background/70 text-muted-foreground'
                    )}
                    disabled={!chatInput.trim()}
                  >
                    {t('common.send')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모바일 하단 액션바 */}
      {isMobile && (
        <ActionBar
          left={[
            {
              key: 'leave',
              label: t('ready.leave'),
              onClick: onLeave,
              variant: 'destructive'
            }
          ]}
          right={[
            ...(mode === 'host'
              ? [
                  {
                    key: 'start',
                    label: t('ready.start'),
                    onClick: onStartGame,
                    variant: 'primary',
                    disabled: !canStartMission
                  } as const
                ]
              : []),
            {
              key: 'ready',
              label: localParticipant?.ready ? t('ready.status.ready') : t('ready.action.ready'),
              onClick: () => {
                if (!localParticipantId) return;
                onToggleReady(localParticipantId);
              }
            },
            {
              key: 'options',
              label: t('common.options'),
              onClick: () => onOptions?.()
            }
          ]}
        />
      )}
    </div>
  );
}

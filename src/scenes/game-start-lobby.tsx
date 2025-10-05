import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cn } from '../lib/utils';
import type { SessionParticipant, SessionRole } from '../domain/session/types';
import type { SessionChatLogEntry } from '../domain/chat/types';
import type { LlmManagerKind } from '../llm/qwen-webgpu';
import { useGuideLoader } from '../domain/llm/use-guide-loader';
import { guideDisplayName } from '../domain/llm/guide-profile';
import { nanoid } from 'nanoid';
import type { LobbyMessageBodies, LobbyMessageKind } from '../protocol';

type GameStartLobbyProps = {
  background: string;
  mode: SessionRole;
  lobbyCode: string;
  answerCode?: string;
  participants: SessionParticipant[];
  localParticipantId: string | null;
  chatMessages: SessionChatLogEntry[];
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
  onToggleReady,
  onStartGame,
  onLeave,
  onAcceptAnswer,
  onOptions,
  autoConnect = false,
  onSendChat,
  llmManager = 'smart',
  publishLobbyMessage
}: GameStartLobbyProps) {
  const [answerInput, setAnswerInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const { ready: llmReady, progress: llmProgress, status: llmStatus, error: llmError } = useGuideLoader({
    manager: llmManager,
    enabled: mode === 'host'
  });
  const everyoneReady = participants.length > 0 && participants.every((participant) => participant.ready);
  const localParticipant = participants.find((participant) => participant.id === localParticipantId);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const progressPercent = llmProgress === null ? null : Math.round(Math.min(1, Math.max(0, llmProgress)) * 100);
  const guideAnnouncedRef = useRef(false);

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

  // 안내인 로드 완료 시, 안내인 이름으로 1회 채팅 합류 알림
  useEffect(() => {
    if (mode !== 'host') return;
    if (!llmReady) return;
    if (!localParticipantId) return;
    if (guideAnnouncedRef.current) return;

    guideAnnouncedRef.current = true;

    const self = participants.find((p) => p.id === localParticipantId);
    const entry = {
      id: nanoid(12),
      authorId: localParticipantId,
      authorName: guideDisplayName(llmManager),
      authorTag: self?.tag ?? '#HOST',
      authorRole: self?.role ?? 'host' as SessionRole,
      body: '채널에 합류했습니다.',
      at: Date.now()
    };
    publishLobbyMessage('chat', { entry }, 'guide-join');
  }, [llmReady, llmManager, localParticipantId, mode, participants, publishLobbyMessage]);

  // 모든 인원 준비 + (호스트인 경우) 안내인까지 준비되어야 시작 가능
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

  const chatPlaceholder = useMemo(() => {
    if (!canSendChat) {
      return '연결 정보를 가져오는 중입니다…';
    }
    return '메시지를 입력하세요 (Shift+Enter로 줄바꿈)';
  }, [canSendChat]);

  return (
    <div
      className="relative min-h-screen w-screen overflow-hidden bg-slate-950 text-foreground"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-slate-950/40" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex-1 py-10">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-10 px-5 sm:px-7 lg:px-12">
            <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2 lg:max-w-3xl">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Greyfall Ready Room</p>
                <h2 className="text-3xl font-semibold lg:text-4xl xl:text-5xl">{mode === 'host' ? '호스트 대기실' : '접속 대기실'}</h2>
                <p className="max-w-prose text-sm text-muted-foreground lg:text-base">
                  모든 플레이어가 준비되면 작전을 시작할 수 있습니다. 팀원 현황과 연결 정보를 확인하고, 오른쪽 버튼으로 채팅을 열어 합류 절차를 안내하세요.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="rounded-md border border-primary/60 px-3 py-2 text-primary transition hover:bg-primary/10"
                >
                  Lobby Chat
                </button>
                {onOptions && (
                  <button type="button" onClick={onOptions} className="rounded-md border border-border/60 px-3 py-2 transition hover:border-primary hover:text-primary">
                    Options
                  </button>
                )}
                <button type="button" onClick={onLeave} className="rounded-md border border-border/60 px-3 py-2 transition hover:border-destructive hover:text-destructive">
                  Leave Lobby
                </button>
              </div>
            </header>

            <section className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr),minmax(380px,460px)]">
              <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Crew Status</h3>
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
                          {isReady ? 'Ready' : 'Standby'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {participants.length === 0 && (
                  <p className="mt-6 rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
                    아직 참가자가 없습니다. 합류 코드를 공유해 팀원을 초대해 보세요.
                  </p>
                )}
              </article>

              <div className="flex flex-col gap-6 text-sm">
                <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                  <header className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      {mode === 'host' ? 'Share Join Code' : autoConnect ? 'Connection Status' : 'Return Answer Code'}
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
                        Copy Code
                      </button>
                    )}
                  </header>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-background/90 px-4 py-4 font-mono text-sm text-primary shadow-inner">
                      {mode === 'host'
                        ? lobbyCode
                        : autoConnect
                          ? '호스트가 자동 연결을 처리할 때까지 잠시만 기다려 주세요…'
                          : answerCode ?? '응답 코드를 생성하는 중입니다.'}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {mode === 'host'
                        ? autoConnect
                          ? '이 코드를 공유하면 플레이어가 자동으로 세션에 합류합니다. 제외해야 할 경우에는 즉시 Leave Lobby를 눌러 세션을 종료하세요.'
                          : '이 코드를 플레이어에게 전달하고, 플레이어가 보내온 응답 코드를 아래에 붙여 넣어 채널을 확정하세요.'
                        : autoConnect
                          ? '호스트의 자동 연결을 기다리는 중입니다. 준비 상태를 맞추고 임무를 시작할 때까지 채팅으로 소통하세요.'
                          : '아래 응답 코드를 복사해 호스트에게 전달하세요. 호스트가 적용하면 연결이 확정됩니다.'}
                    </p>
                  </div>

                  {mode === 'host' && onAcceptAnswer && !autoConnect && (
                    <div className="mt-5 space-y-3">
                      <label
                        htmlFor="answer-input"
                        className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground"
                      >
                        Apply Answer Code
                      </label>
                      <textarea
                        id="answer-input"
                        value={answerInput}
                        onChange={(event) => setAnswerInput(event.target.value)}
                        placeholder="플레이어가 전달한 응답 코드를 붙여넣으세요"
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
                        Confirm Answer
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
                      Copy Answer Code
                    </button>
                  )}
                </article>

                <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Ready Check</h3>
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
                        {localParticipant.ready ? 'Cancel Ready' : 'Set Ready'}
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
                        Start Mission
                      </button>
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

      {mode === 'host' && (llmProgress !== null || llmError) && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 w-[min(320px,90vw)] -translate-x-1/2 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-xs text-muted-foreground shadow-lg backdrop-blur">
          <p className="font-semibold text-foreground">
            {llmError ? 'LLM 초기화 실패' : llmStatus ?? 'WebGPU 초기화 중…'}
          </p>
          {llmError ? (
            <p className="mt-1 text-[11px] text-destructive">{llmError}</p>
          ) : (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressPercent ?? 0}%` }}
              />
            </div>
          )}
        </div>
      )}

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
              Close
            </button>

            <header className="border-b border-border/60 px-5 pb-5 pt-6 pr-16">
              <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">Lobby Chat</p>
              <h3 className="text-xl font-semibold text-foreground">Greyfall Ready Room Comms</h3>
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
                          {message.authorRole === 'host' ? 'HOST' : 'GUEST'}
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
                <span>Enter 키로 전송 · Shift+Enter로 줄바꿈</span>
                <div className="flex items-center gap-2">
                  <span>{canSendChat ? '채널 연결됨' : '세션 연결 대기 중'}</span>
                  <button
                    type="submit"
                    className={cn(
                      'rounded-md border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition',
                      canSendChat && chatInput.trim()
                        ? 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                        : 'border-border bg-background/70 text-muted-foreground'
                    )}
                    disabled={!canSendChat || !chatInput.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

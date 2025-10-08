import { useCallback, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { useI18n } from '../../../i18n';
import { FallbackBackground } from '../../common/fallback-bg';
import { useResponsive } from '../../responsive/use-responsive';
import { ActionBar } from '../../responsive/action-bar';
import type { StartLobbyLayoutProps } from './types';

type Variant = 'standard' | 'tall' | 'wide';

type StartLobbyLayoutBaseProps = StartLobbyLayoutProps & {
  variant: Variant;
};

function StartLobbyLayoutBase({
  variant,
  background,
  mode,
  lobbyCode,
  answerCode,
  autoConnect,
  participants,
  localParticipant,
  localParticipantId,
  canSendChat,
  chatMessages,
  chatInput,
  answerInput,
  chatOpen,
  canStartMission,
  llmPrewarmPct,
  llmPrewarmText,
  onOptions,
  onLeave,
  onStartGame,
  onToggleReady,
  onAnswerInputChange,
  onAnswerSubmit,
  onChatInputChange,
  onChatSubmit,
  onChatOpen,
  onChatClose,
  onCopyLobbyCode,
  onCopyAnswerCode,
  onChatKeyDown,
  chatListRef
}: StartLobbyLayoutBaseProps) {
  const { t } = useI18n();
  const { isMobile } = useResponsive();

  const activeParticipant = useMemo(() => {
    if (localParticipant) return localParticipant;
    if (!localParticipantId) return undefined;
    return participants.find((participant) => participant.id === localParticipantId);
  }, [localParticipant, localParticipantId, participants]);

  const bgObjectFit = variant === 'wide' ? 'contain' : 'cover';
  const bgObjectPosition =
    variant === 'wide' ? 'center' : variant === 'tall' ? 'center 40%' : 'center 34%';

  const containerClass = cn(
    'mx-auto flex h-full w-full flex-col gap-10',
    variant === 'standard' && 'max-w-7xl px-5 sm:px-7 lg:px-12',
    variant === 'wide' && 'max-w-[1600px] px-6 sm:px-10 lg:px-16',
    variant === 'tall' && 'max-w-4xl px-6 sm:px-8'
  );

  const headerClass = cn(
    'flex flex-col gap-5 md:flex-row md:items-start md:justify-between',
    variant === 'tall' && 'items-center text-center md:flex-col md:gap-6'
  );

  const headerMetaClass = cn(
    'flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground',
    variant === 'tall' && 'justify-center'
  );

  const layoutSectionClass =
    variant === 'tall'
      ? 'flex flex-col gap-6'
      : cn(
          'grid gap-8',
          variant === 'standard' && 'lg:grid-cols-[minmax(0,1.25fr),minmax(380px,460px)]',
          variant === 'wide' && 'lg:grid-cols-[minmax(0,1.35fr),minmax(420px,520px)]'
        );

  const chatPanelWidthClass =
    variant === 'wide'
      ? 'sm:w-[28rem] sm:rounded-l-2xl lg:w-[32rem]'
      : 'sm:w-[26rem] sm:rounded-l-2xl lg:w-[30rem]';

  const handleCopyLobby = useCallback(() => {
    if (onCopyLobbyCode) {
      onCopyLobbyCode();
      return;
    }
    void navigator.clipboard.writeText(lobbyCode).catch((error) => {
      console.warn('[ui] failed to copy lobby code', error);
    });
  }, [lobbyCode, onCopyLobbyCode]);

  const handleCopyAnswer = useCallback(() => {
    if (!answerCode) return;
    if (onCopyAnswerCode) {
      onCopyAnswerCode();
      return;
    }
    void navigator.clipboard.writeText(answerCode).catch((error) => {
      console.warn('[ui] failed to copy answer code', error);
    });
  }, [answerCode, onCopyAnswerCode]);

  const chatSendDisabled = !chatInput.trim();

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-slate-950 text-foreground">
      <FallbackBackground src={background} objectFit={bgObjectFit} objectPosition={bgObjectPosition} />
      <div className="absolute inset-0 bg-slate-950/28" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/25 via-slate-900/45 to-slate-950/75" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex-1 py-10">
          <div className={containerClass}>
            <header className={headerClass}>
              <div className={cn('space-y-2', variant !== 'tall' && 'lg:max-w-3xl')}>
                <p className="text-xs uppercase tracking-[0.35em] text-primary/80">{t('ready.brand')}</p>
                <h2 className="text-3xl font-semibold lg:text-4xl xl:text-5xl">
                  {mode === 'host' ? t('ready.header.host') : t('ready.header.guest')}
                </h2>
                <p className="mx-auto max-w-prose text-sm text-muted-foreground lg:text-base">
                  {t('ready.description')}
                </p>
              </div>
              <div className={headerMetaClass}>
                <button
                  type="button"
                  onClick={onChatOpen}
                  className="rounded-md border border-primary/60 px-3 py-2 text-primary transition hover:bg-primary/10"
                >
                  {t('ready.chat.open')}
                </button>
                {onOptions && (
                  <button
                    type="button"
                    onClick={onOptions}
                    className="rounded-md border border-border/60 px-3 py-2 transition hover:border-primary hover:text-primary"
                  >
                    {t('common.options')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLeave}
                  className="rounded-md border border-border/60 px-3 py-2 transition hover:border-destructive hover:text-destructive"
                >
                  {t('ready.leave')}
                </button>
              </div>
            </header>

            <section className={layoutSectionClass}>
              <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {t('ready.crewStatus')}
                  </h3>
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    {participants.length}명 연결
                  </span>
                </div>
                <ul className="mt-5 space-y-4 text-sm">
                  {participants.map((participant) => {
                    const isReady = participant.ready;
                    return (
                      <li
                        key={participant.id}
                        className={cn(
                          'grid gap-4 rounded-xl border border-border/60 bg-background/75 px-5 py-4 shadow-sm transition sm:grid-cols-[auto,1fr,auto]',
                          isReady ? 'border-primary/70 ring-1 ring-primary/30' : undefined
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold uppercase tracking-[0.25em]',
                            participant.role === 'host' ? 'border-primary/70 text-primary' : 'border-border/60 text-muted-foreground'
                          )}
                        >
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

              <div className={cn('flex flex-col gap-6 text-sm', variant === 'tall' && 'lg:flex-row lg:items-start lg:gap-6')}>
                <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                  <header className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      {mode === 'host'
                        ? t('ready.card.shareJoin')
                        : autoConnect
                          ? t('ready.card.connection')
                          : t('ready.card.returnAnswer')}
                    </h3>
                    {mode === 'host' && (
                      <button
                        type="button"
                        className="rounded-md border border-primary/60 bg-primary/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary-foreground transition hover:bg-primary"
                        onClick={handleCopyLobby}
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

                  {mode === 'host' && onAnswerSubmit && !autoConnect && (
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
                        onChange={(event) => onAnswerInputChange(event.target.value)}
                        className="min-h-[4.5rem] w-full resize-none rounded-xl border border-border/60 bg-background/85 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        autoCapitalize="off"
                      />
                      <button
                        type="button"
                        className="w-full rounded-md border border-primary bg-primary/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground transition hover:bg-primary"
                        onClick={() => onAnswerSubmit(answerInput)}
                      >
                        {t('ready.confirmAnswer')}
                      </button>
                    </div>
                  )}

                  {mode === 'guest' && !autoConnect && answerCode && (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
                      onClick={handleCopyAnswer}
                    >
                      {t('ready.copyAnswer')}
                    </button>
                  )}
                </article>

                <article className="rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {t('ready.check')}
                  </h3>
                  <div className="mt-4 space-y-3">
                    {activeParticipant && (
                      <div className="flex w-full flex-col gap-3">
                        {!activeParticipant.ready ? (
                          <button
                            type="button"
                            className={cn(
                              'w-full rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition',
                              'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                            )}
                            onClick={() => onOpenCharacterBuilder?.()}
                          >
                            {t('ready.set')}
                          </button>
                        ) : (
                          <div className="flex w-full gap-3">
                            <button
                              type="button"
                              className={cn(
                                'flex-1 rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition',
                                'border-border/60 bg-background/70 text-foreground hover:border-primary hover:text-primary'
                              )}
                              onClick={() => onOpenCharacterBuilder?.()}
                            >
                              {t('char.modify')}
                            </button>
                            <button
                              type="button"
                              className={cn(
                                'flex-1 rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition',
                                'border-destructive/60 bg-destructive/15 text-destructive hover:bg-destructive/25'
                              )}
                              onClick={() => onToggleReady(activeParticipant.id)}
                            >
                              {t('ready.cancel')}
                            </button>
                          </div>
                        )}
                      </div>
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
                        onClick={onStartGame}
                      >
                        <span className="inline-flex items-center gap-2">
                          {t('ready.startMission')}
                          {llmPrewarmPct != null && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition',
                                canStartMission
                                  ? 'bg-emerald-950/25 text-emerald-50 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                                  : 'bg-slate-950/35 text-slate-200 shadow-inner shadow-black/30'
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-3 w-3 animate-spin rounded-full border border-b-transparent',
                                  canStartMission ? 'border-emerald-100/85' : 'border-slate-200/75'
                                )}
                              />
                              <span className="leading-none">{llmPrewarmPct}%</span>
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

      {chatOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="absolute inset-0 z-0" data-cursor="pointer" aria-hidden="true" onClick={onChatClose} />
          <div
            className={cn(
              'relative z-10 flex h-full w-full max-w-full flex-col border-l border-border/60 bg-card/95 shadow-2xl transition-transform',
              chatPanelWidthClass
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-md border border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground transition hover:border-primary hover:text-primary"
              onClick={onChatClose}
            >
              {t('common.close')}
            </button>

            <header className="border-b border-border/60 px-5 pb-5 pt-6 pr-16">
              <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">{t('ready.chat.title')}</p>
              <h3 className="text-xl font-semibold text-foreground">{t('ready.chat.subtitle')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t('ready.chat.help')}</p>
            </header>

            <div ref={chatListRef} className="scrollbar-lobby flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {chatMessages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                  {t('ready.chat.empty')}
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
                          message.isSelf ? 'bg-primary/85 text-primary-foreground' : 'bg-background/85 text-foreground'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                onChatSubmit();
              }}
              className="space-y-3 border-t border-border/60 px-5 py-5"
            >
              <textarea
                value={chatInput}
                onChange={(event) => onChatInputChange(event.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder={t('ready.chat.placeholder')}
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
                      !chatSendDisabled && canSendChat
                        ? 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                        : 'border-border bg-background/70 text-muted-foreground'
                    )}
                    disabled={chatSendDisabled}
                  >
                    {t('common.send')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    label: t('ready.startMission'),
                    onClick: onStartGame,
                    variant: 'primary',
                    disabled: !canStartMission
                  } as const
                ]
              : []),
            {
              key: 'ready',
              label: activeParticipant?.ready ? t('ready.status.ready') : t('ready.action.ready'),
              onClick: () => {
                if (!localParticipantId) return;
                onToggleReady(localParticipantId);
              }
            },
            ...(onOptions
              ? [
                  {
                    key: 'options',
                    label: t('common.options'),
                    onClick: onOptions
                  } as const
                ]
              : [])
          ]}
        />
      )}
    </div>
  );
}

export default StartLobbyLayoutBase;

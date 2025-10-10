import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { exitFullscreen, getFullscreenElement, requestFullscreen } from '../../lib/fullscreen';
import {
  selectAssetPreloadEnabled,
  selectFullscreenEnabled,
  selectMusicEnabled,
  selectPreferencesLoaded,
  selectSfxEnabled,
  usePreferencesStore,
} from '../../store/preferences';
import { useI18n } from '../../i18n';
import type { LocaleKey } from '../../i18n/config';
import { LanguagePicker } from '../common/language-picker';
import { purgeLocalModels, type WebLLMProgress } from '../../llm/llm-engine';
import { useAssetPreloadStore, selectAssetPreloadSnapshot } from '../../domain/assets/preload-store';
import { useSliderPreference } from './use-slider-preference';

const TABS = [
  { key: 'music', label: '음악' },
  { key: 'display', label: '화면' },
  { key: 'controls', label: '기타' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

type OptionsDialogProps = {
  open: boolean;
  onClose: () => void;
  scene: 'mainLobby' | 'startLobby' | 'game';
  onEnableMusic?: () => void;
  onPreviewMusicVolume?: (volume: number) => void;
};

export function OptionsDialog({ open, onClose, scene, onEnableMusic, onPreviewMusicVolume }: OptionsDialogProps) {
  const { t, locale, setLocale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('music');
  const preferencesLoaded = usePreferencesStore(selectPreferencesLoaded);
  const musicEnabled = usePreferencesStore(selectMusicEnabled);
  const sfxEnabled = usePreferencesStore(selectSfxEnabled);
  const fullscreenEnabled = usePreferencesStore(selectFullscreenEnabled);
  const debugPageEnabled = usePreferencesStore((s) => s.debugPageEnabled);
  const assetPreloadEnabled = usePreferencesStore(selectAssetPreloadEnabled);
  const setPreference = usePreferencesStore((state) => state.setPreference);
  const load = usePreferencesStore((state) => state.load);
  const preloadSnapshot = useAssetPreloadStore(selectAssetPreloadSnapshot);

  const handleMusicToggle = useCallback(
    (value: boolean) => {
      setPreference('musicEnabled', value);
      if (value) {
        onEnableMusic?.();
      }
    },
    [onEnableMusic, setPreference]
  );

  const {
    value: musicVolumeSlider,
    handleChange: handleMusicVolumeChange,
    flushPending: flushMusicVolume,
  } = useSliderPreference({
    key: 'musicVolume',
    toSlider: (value) => Math.round(value * 100),
    fromSlider: (value) => Math.min(1, Math.max(0, value / 100)),
    onPreview: onPreviewMusicVolume,
  });

  const {
    value: sfxVolumeSlider,
    handleChange: handleSfxVolumeChange,
    flushPending: flushSfxVolume,
  } = useSliderPreference({
    key: 'sfxVolume',
    toSlider: (value) => Math.round(value * 100),
    fromSlider: (value) => Math.min(1, Math.max(0, value / 100)),
  });

  useEffect(() => {
    if (!preferencesLoaded) {
      load();
    }
  }, [preferencesLoaded, load]);

  useEffect(() => {
    if (open) {
      setActiveTab('music');
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      flushMusicVolume();
      flushSfxVolume();
    }
  }, [flushMusicVolume, flushSfxVolume, open]);
  if (!open) return null;

  const applyFullscreen = async (value: boolean) => {
    setPreference('fullscreenEnabled', value);

    if (typeof document === 'undefined') return;

    try {
      const current = getFullscreenElement();
      if (value) {
        if (!current) {
          await requestFullscreen(document.documentElement, `options-toggle ${scene}`);
        }
      } else if (current) {
        await exitFullscreen(undefined, 'options-toggle manual');
      }
    } catch (error) {
      console.warn('[options] fullscreen toggle failed', error);
      const active = Boolean(getFullscreenElement());
      setPreference('fullscreenEnabled', active);
    }
  };

  let tabContent: JSX.Element;
  if (activeTab === 'controls') {
    const percent = preloadSnapshot.total > 0 ? Math.round((preloadSnapshot.completed / preloadSnapshot.total) * 100) : 0;
    const statusLabel = (() => {
      switch (preloadSnapshot.status) {
        case 'running':
          return t('assets.preload.state.running');
        case 'paused':
          return t('assets.preload.state.paused');
        case 'done':
          return t('assets.preload.state.done');
        case 'cancelled':
          return t('assets.preload.state.cancelled');
        default:
          return t('assets.preload.state.idle');
      }
    })();
    const statusLine = t('assets.preload.statusLine', {
      status: statusLabel,
      percent,
      completed: preloadSnapshot.completed,
      total: preloadSnapshot.total,
    });
    const lastEntryLabel = preloadSnapshot.lastEntry ? preloadSnapshot.lastEntry.url : null;
    const errorsLabel = preloadSnapshot.errors.length > 0
      ? t('assets.preload.errors', { count: preloadSnapshot.errors.length })
      : null;
    tabContent = (
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-card/60 p-6 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">도구</p>
          <p className="mb-2">로컬 LLM 아티팩트(Transformers.js 캐시)를 정리할 수 있어요.</p>
          <PurgeModelsPanel />
        </div>

        <OptionToggle
          label={t('debug.enable')}
          description={t('debug.enable.desc')}
          checked={Boolean(debugPageEnabled)}
          onChange={(value) => setPreference('debugPageEnabled', value)}
        />

        <AssetPreloadCard
          enabled={assetPreloadEnabled}
          onToggle={(value) => setPreference('assetPreloadEnabled', value)}
          statusLine={statusLine}
          lastEntryLabel={lastEntryLabel ?? t('assets.preload.noRecent')}
          errorsLabel={errorsLabel}
          title={t('assets.preload')}
          description={t('assets.preload.desc')}
        />
      </div>
    );
  } else if (activeTab === 'display') {
    tabContent = (
      <div className="flex flex-col gap-4">
        <OptionToggle
          label={t('display.fullscreen')}
          description={t('display.fullscreen.desc')}
          checked={fullscreenEnabled}
          onChange={(value) => void applyFullscreen(value)}
        />
        <LanguagePicker
          label={t('options.language')}
          description={t('options.language.desc')}
          value={locale}
          onChange={(value: string) => setLocale(value as LocaleKey)}
          options={[
            { value: 'en', label: 'english' },
            { value: 'ko', label: '한국어' }
          ]}
        />
        <p className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-xs text-muted-foreground">{t('display.fullscreen.note')}</p>
      </div>
    );
  } else {
    tabContent = (
      <div className="flex flex-col gap-4">
        <OptionToggle
          label={t('music.bgm')}
          description={t('music.bgm.desc')}
          checked={musicEnabled}
          onChange={handleMusicToggle}
        />
        <OptionSlider
          label={t('music.bgm.volume')}
          description={t('music.bgm.volume.desc')}
          value={musicVolumeSlider}
          onChange={handleMusicVolumeChange}
          disabled={!musicEnabled}
        />
        <OptionToggle
          label={t('sfx.title')}
          description={t('sfx.desc')}
          checked={sfxEnabled}
          onChange={(value) => setPreference('sfxEnabled', value)}
        />
        <OptionSlider
          label={t('sfx.volume')}
          description={t('sfx.volume.desc')}
          value={sfxVolumeSlider}
          onChange={handleSfxVolumeChange}
          disabled={!sfxEnabled}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 py-6 sm:px-6 sm:py-10 backdrop-blur">
      <div className="flex h-[520px] w-full max-w-3xl flex-col gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl sm:h-[560px]">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('options.subtitle')}</p>
            <h2 className="text-2xl font-semibold">{t('options.title')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('options.scene.current')}: {scene === 'mainLobby' ? t('scene.mainLobby') : scene === 'startLobby' ? t('scene.startLobby') : t('scene.game')}
            </p>
          </div>
          <button
            type="button"
            className="self-start rounded-md border border-border bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </header>

        <div className="flex flex-1 gap-4 overflow-hidden">
          <aside className="w-36 flex-shrink-0 rounded-xl border border-border/60 bg-card/70 p-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:w-44">
            <nav className="flex h-full flex-col gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  data-cursor="pointer"
                  className={cn(
                    'rounded-lg px-3 py-2 text-left transition',
                    activeTab === tab.key ? 'bg-primary/90 text-primary-foreground shadow-sm' : 'hover:bg-card/50'
                  )}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.key === 'music'
                    ? t('tabs.music')
                    : tab.key === 'display'
                      ? t('tabs.display')
                      : t('tabs.controls')}
                </button>
              ))}
            </nav>
          </aside>

          <section className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto pr-1 text-sm md:pr-2">{tabContent}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

type OptionToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

function OptionToggle({ label, description, checked, onChange, disabled }: OptionToggleProps) {
  return (
    <label
      data-cursor="pointer"
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card/70 p-4 transition',
        checked ? 'border-primary/70 shadow-inner shadow-primary/10' : undefined,
        disabled ? 'cursor-not-allowed opacity-60' : undefined
      )}
    >
      <span>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 cursor-pointer rounded border border-border accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

type OptionSliderProps = {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function OptionSlider({ label, description, value, onChange, disabled }: OptionSliderProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-border/60 bg-card/70 p-4',
        disabled ? 'opacity-60' : undefined
      )}
    >
      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{clamped}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={clamped}
        disabled={disabled}
        className="w-full cursor-pointer accent-primary"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

type AssetPreloadCardProps = {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  statusLine: string;
  lastEntryLabel: string;
  errorsLabel?: string | null;
  title: string;
  description: string;
};

function AssetPreloadCard({
  enabled,
  onToggle,
  statusLine,
  lastEntryLabel,
  errorsLabel,
  title,
  description
}: AssetPreloadCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <label className="flex items-center gap-2" data-cursor="pointer">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {enabled ? 'ON' : 'OFF'}
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer rounded border border-border accent-primary"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
        </label>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="font-semibold text-xs uppercase tracking-[0.25em] text-primary/80">{statusLine}</p>
        <p className="truncate text-[11px] text-muted-foreground/80">{lastEntryLabel}</p>
        {errorsLabel ? <p className="text-[11px] text-rose-300">{errorsLabel}</p> : null}
      </div>
    </div>
  );
}

function PurgeModelsPanel() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handlePurge = async () => {
    setBusy(true);
    setStatus('초기화 중…');
    const ok = await purgeLocalModels((r: WebLLMProgress) => {
      if (r?.text) setStatus(r.text!);
    });
    setBusy(false);
    setStatus(ok ? '정리 완료' : '정리 실패');
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4">
      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="font-semibold text-foreground">로컬 LLM 캐시 삭제</p>
          <p className="text-xs text-muted-foreground">다운로드된 모델/토크나이저 캐시와 저장소를 정리합니다.</p>
        </div>
        <button
          type="button"
          className={cn('rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] transition', busy ? 'opacity-70 cursor-not-allowed' : 'border-destructive text-destructive hover:bg-destructive/10')}
          onClick={handlePurge}
          disabled={busy}
        >
          {busy ? '삭제 중…' : '삭제'}
        </button>
      </div>
      {status && <p className="text-[11px] text-muted-foreground">{status}</p>}
    </div>
  );
}

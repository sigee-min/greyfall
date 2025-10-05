import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { exitFullscreen, getFullscreenElement, requestFullscreen } from '../../lib/fullscreen';
import {
  selectFullscreenEnabled,
  selectMusicEnabled,
  selectMusicVolume,
  selectPreferencesLoaded,
  selectSfxEnabled,
  selectSfxVolume,
  usePreferencesStore
} from '../../store/preferences';

const TABS = [
  { key: 'music', label: '음악' },
  { key: 'controls', label: '컨트롤' },
  { key: 'display', label: '화면' }
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
  const [activeTab, setActiveTab] = useState<TabKey>('music');
  const preferencesLoaded = usePreferencesStore(selectPreferencesLoaded);
  const musicEnabled = usePreferencesStore(selectMusicEnabled);
  const musicVolume = usePreferencesStore(selectMusicVolume);
  const [musicVolumeDraft, setMusicVolumeDraft] = useState(() => musicVolume);
  const sfxEnabled = usePreferencesStore(selectSfxEnabled);
  const sfxVolume = usePreferencesStore(selectSfxVolume);
  const fullscreenEnabled = usePreferencesStore(selectFullscreenEnabled);
  const setPreference = usePreferencesStore((state) => state.setPreference);
  const load = usePreferencesStore((state) => state.load);
  const debouncedVolumeRef = useRef<number | null>(null);
  const volumeCommitTimeoutRef = useRef<number | null>(null);

  const flushVolumeChange = useCallback(() => {
    if (debouncedVolumeRef.current === null) return;
    setPreference('musicVolume', debouncedVolumeRef.current);
    debouncedVolumeRef.current = null;
    if (volumeCommitTimeoutRef.current !== null) {
      window.clearTimeout(volumeCommitTimeoutRef.current);
      volumeCommitTimeoutRef.current = null;
    }
  }, [setPreference]);


  const handleMusicToggle = useCallback(
    (value: boolean) => {
      setPreference('musicEnabled', value);
      if (value) {
        onEnableMusic?.();
      }
    },
    [onEnableMusic, setPreference]
  );

  const handleMusicVolumeChange = useCallback((value: number) => {
    const normalized = value / 100;
    setMusicVolumeDraft(normalized);
    onPreviewMusicVolume?.(normalized);
    if (typeof window === 'undefined') {
      setPreference('musicVolume', normalized);
      return;
    }
    window.requestAnimationFrame(() => {
      debouncedVolumeRef.current = normalized;
      if (volumeCommitTimeoutRef.current !== null) {
        window.clearTimeout(volumeCommitTimeoutRef.current);
      }
      volumeCommitTimeoutRef.current = window.setTimeout(flushVolumeChange, 120);
    });
  }, [flushVolumeChange, onPreviewMusicVolume, setPreference]);

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

  useEffect(() => {
    setMusicVolumeDraft(musicVolume);
  }, [musicVolume, open]);


  useEffect(() => {
    return () => {
      flushVolumeChange();
      if (volumeCommitTimeoutRef.current !== null) {
        window.clearTimeout(volumeCommitTimeoutRef.current);
        volumeCommitTimeoutRef.current = null;
      }
    };
  }, [flushVolumeChange]);
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
    tabContent = (
      <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-card/60 p-6 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">컨트롤 설정</p>
        <p>커스텀 키 바인딩과 단축 키 설정 기능을 준비 중입니다. 곧 조작 키를 원하는 방식으로 변경할 수 있게 됩니다.</p>
      </div>
    );
  } else if (activeTab === 'display') {
    tabContent = (
      <div className="flex flex-col gap-4">
        <OptionToggle
          label="전체 화면"
          description="로비, 준비실, 게임 화면을 모두 전체 화면으로 표시합니다."
          checked={fullscreenEnabled}
          onChange={(value) => void applyFullscreen(value)}
        />
        <p className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-xs text-muted-foreground">
          브라우저에서 Esc 키로 직접 전체 화면을 종료하거나 다시 진입하면 이 설정이 자동으로 동기화됩니다.
        </p>
      </div>
    );
  } else {
    tabContent = (
      <div className="flex flex-col gap-4">
        <OptionToggle
          label="배경 음악"
          description="로비와 임무 중 ambience 음악을 재생합니다."
          checked={musicEnabled}
          onChange={handleMusicToggle}
        />
        <OptionSlider
          label="배경 음악 음량"
          description="0%로 설정하면 음악이 들리지 않습니다."
          value={Math.round(musicVolumeDraft * 100)}
          onChange={handleMusicVolumeChange}
          disabled={!musicEnabled}
        />
        <OptionToggle
          label="효과음"
          description="버튼 클릭과 알림 등 UI 효과음을 재생합니다."
          checked={sfxEnabled}
          onChange={(value) => setPreference('sfxEnabled', value)}
        />
        <OptionSlider
          label="효과음 음량"
          description="UI 효과음 및 상호작용 사운드의 크기를 조절합니다."
          value={Math.round(sfxVolume * 100)}
          onChange={(value) => setPreference('sfxVolume', value / 100)}
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
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Operations Preferences</p>
            <h2 className="text-2xl font-semibold">Options</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              현재 씬: {scene === 'mainLobby' ? '로비' : scene === 'startLobby' ? '게임 준비실' : '작전 현장'}
            </p>
          </div>
          <button
            type="button"
            className="self-start rounded-md border border-border bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            Close
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
                  {tab.label}
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

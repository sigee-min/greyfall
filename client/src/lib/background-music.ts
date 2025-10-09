import { useCallback, useEffect, useMemo } from 'react';
import type { SceneKey } from '../types/scenes';

type BackgroundMusicHandle = {
  resume: (reason?: string) => void;
  previewVolume: (volume: number) => void;
};

type UnlockHandler = () => void;

let audioA: HTMLAudioElement | null = null;
let audioB: HTMLAudioElement | null = null;
let active: 'A' | 'B' = 'A';
let unlockHandler: UnlockHandler | null = null;
let attachedSourcesKey: string | null = null;

function ensureAudioElements(): { a: HTMLAudioElement; b: HTMLAudioElement } | null {
  if (typeof document === 'undefined') return null;
  if (audioA && audioB) return { a: audioA, b: audioB };
  const make = (tag: string) => {
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.loop = true;
    el.style.display = 'none';
    el.dataset.greyfallAudio = tag;
    document.body.appendChild(el);
    return el;
  };
  audioA = audioA ?? make('A');
  audioB = audioB ?? make('B');
  return { a: audioA!, b: audioB! };
}

function disposeUnlockHandler() {
  if (!unlockHandler) return;
  document.removeEventListener('pointerdown', unlockHandler);
  document.removeEventListener('keydown', unlockHandler);
  unlockHandler = null;
}

function attachSources(audio: HTMLAudioElement, sources: string[], sourcesKey: string) {
  if (attachedSourcesKey === sourcesKey) return;

  while (audio.firstChild) {
    audio.removeChild(audio.firstChild);
  }

  sources.forEach((src) => {
    const element = document.createElement('source');
    element.src = src;
    element.type = inferMime(src);
    audio.appendChild(element);
  });

  audio.load();
  attachedSourcesKey = sourcesKey;
}

async function attemptPlay(audio: HTMLAudioElement, reason: string): Promise<void> {
  disposeUnlockHandler();

  try {
    await audio.play();
  } catch (error) {
    const handler: UnlockHandler = () => {
      disposeUnlockHandler();
      void audio.play().catch((unlockError) => {
        console.warn(`[audio] playback blocked after unlock (${reason})`, unlockError);
      });
    };
    unlockHandler = handler;
    document.addEventListener('pointerdown', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
    console.warn(`[audio] playback blocked (${reason})`, error);
  }
}

export function useBackgroundMusic(
  tracks: string | string[],
  enabled: boolean,
  volume: number,
  scene: SceneKey,
  fallbackTracks?: string | string[]
): BackgroundMusicHandle {
  const primary = useMemo(() => (Array.isArray(tracks) ? [...tracks] : [tracks]), [tracks]);
  const fallback = useMemo(
    () => (fallbackTracks ? (Array.isArray(fallbackTracks) ? [...fallbackTracks] : [fallbackTracks]) : []),
    [fallbackTracks]
  );
  const sources = useMemo(() => [...primary, ...fallback], [primary, fallback]);
  const sourcesKey = useMemo(() => sources.join('|'), [sources]);
  const shouldPlay = enabled; // play across scenes; caller controls tracks

  useEffect(() => {
    const pair = ensureAudioElements();
    if (!pair) return;
    const current = active === 'A' ? pair.a : pair.b;
    const next = active === 'A' ? pair.b : pair.a;

    // If sources changed, crossfade to next
    attachSources(next, sources, sourcesKey);
    next.volume = 0;

    if (shouldPlay) {
      void attemptPlay(next, 'state-change');
      const target = clampVolume(volume);
      const start = performance.now();
      const duration = 400; // ms
      const fade = () => {
        const t = Math.min(1, (performance.now() - start) / duration);
        next.volume = target * t;
        current.volume = target * (1 - t);
        if (t < 1) requestAnimationFrame(fade);
        else {
          current.pause();
          active = active === 'A' ? 'B' : 'A';
        }
      };
      requestAnimationFrame(fade);
    } else {
      current.pause();
      next.pause();
      disposeUnlockHandler();
    }
  }, [shouldPlay, sources, sourcesKey, volume]);

  useEffect(() => {
    return () => {
      if (audioA) audioA.pause();
      if (audioB) audioB.pause();
      disposeUnlockHandler();
    };
  }, []);

  const resume = useCallback((reason: string = 'manual') => {
    const pair = ensureAudioElements();
    if (!pair) return;
    const next = active === 'A' ? pair.a : pair.b;
    attachSources(next, sources, sourcesKey);
    next.volume = clampVolume(volume);
    void attemptPlay(next, reason);
  }, [sources, sourcesKey, volume]);

  const previewVolume = useCallback((nextVolume: number) => {
    const pair = ensureAudioElements();
    if (!pair) return;
    const cur = active === 'A' ? pair.a : pair.b;
    cur.volume = clampVolume(nextVolume);
  }, []);

  return useMemo(() => ({ resume, previewVolume }), [resume, previewVolume]);
}

function clampVolume(volume: number) {
  if (Number.isNaN(volume)) return 0;
  return Math.min(1, Math.max(0, volume));
}

function inferMime(path: string) {
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.wav')) return 'audio/wav';
  if (path.endsWith('.ogg')) return 'audio/ogg';
  if (path.endsWith('.webm')) return 'audio/webm';
  return '';
}

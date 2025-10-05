import { useCallback, useEffect, useMemo } from 'react';
import type { SceneKey } from '../types/scenes';

type BackgroundMusicHandle = {
  resume: (reason?: string) => void;
  previewVolume: (volume: number) => void;
};

type UnlockHandler = () => void;

let audioElement: HTMLAudioElement | null = null;
let unlockHandler: UnlockHandler | null = null;
let attachedSourcesKey: string | null = null;

function ensureAudioElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  if (audioElement) return audioElement;

  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.loop = true;
  audio.style.display = 'none';
  audio.dataset.greyfallAudio = 'lobby';
  document.body.appendChild(audio);
  audioElement = audio;
  return audio;
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
  scene: SceneKey
): BackgroundMusicHandle {
  const sources = useMemo(() => (Array.isArray(tracks) ? [...tracks] : [tracks]), [tracks]);
  const sourcesKey = useMemo(() => sources.join('|'), [sources]);
  const shouldPlay = enabled && scene !== 'game';

  useEffect(() => {
    const audio = ensureAudioElement();
    if (!audio) return;

    attachSources(audio, sources, sourcesKey);
    audio.volume = clampVolume(volume);

    if (shouldPlay) {
      void attemptPlay(audio, 'state-change');
    } else {
      audio.pause();
      disposeUnlockHandler();
    }
  }, [sources, sourcesKey, shouldPlay, volume]);

  useEffect(() => {
    return () => {
      if (!audioElement) return;
      audioElement.pause();
      disposeUnlockHandler();
    };
  }, []);

  const resume = useCallback((reason: string = 'manual') => {
    const audio = ensureAudioElement();
    if (!audio) return;
    attachSources(audio, sources, sourcesKey);
    audio.volume = clampVolume(volume);
    void attemptPlay(audio, reason);
  }, [sources, sourcesKey, volume]);

  const previewVolume = useCallback((nextVolume: number) => {
    const audio = audioElement;
    if (!audio) return;
    audio.volume = clampVolume(nextVolume);
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

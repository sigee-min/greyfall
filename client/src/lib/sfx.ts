type AudioContextCtor = typeof AudioContext;

let audioContext: AudioContext | null = null;
const audioBufferCache = new Map<string, AudioBuffer>();
const audioBufferPromises = new Map<string, Promise<AudioBuffer | null>>();
const htmlAudioPools = new Map<string, HTMLAudioElement[]>();

const UI_CLICK_PATH = '/assets/audio/ui/ui-click.mp3';
const UI_HOVER_PATH = '/assets/audio/ui/ui-hover.mp3';

const clampVolume = (value: number) => Math.min(1, Math.max(0, value));

function getContext() {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const win = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  const Ctor = win.AudioContext || win.webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

export async function playSelectionCue() {
  const ctx = getContext();
  if (!ctx) return;

  await resumeContext(ctx);

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(480, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.3);
}

export function playUiClick(volume = 0.7) {
  void playOneShot(UI_CLICK_PATH, volume);
}

export function playUiHover(volume = 0.5) {
  void playOneShot(UI_HOVER_PATH, volume);
}

async function playOneShot(path: string, volume: number) {
  if (typeof window === 'undefined') return;

  const ctx = getContext();
  if (!ctx) {
    playWithHtmlAudio(path, volume);
    return;
  }

  try {
    await resumeContext(ctx);
    const buffer = await loadAudioBuffer(ctx, path);
    if (!buffer) {
      playWithHtmlAudio(path, volume);
      return;
    }

    const gain = ctx.createGain();
    gain.gain.value = clampVolume(volume);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    });
  } catch (error) {
    console.warn('Failed to play UI sound via AudioContext. Falling back to HTMLAudioElement.', error);
    playWithHtmlAudio(path, volume);
  }
}

async function resumeContext(ctx: AudioContext) {
  if (ctx.state !== 'suspended') return;
  try {
    await ctx.resume();
  } catch (error) {
    console.warn('Failed to resume AudioContext.', error);
  }
}

async function loadAudioBuffer(ctx: AudioContext, path: string) {
  const cached = audioBufferCache.get(path);
  if (cached) return cached;

  let pending = audioBufferPromises.get(path);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        audioBufferCache.set(path, buffer);
        return buffer;
      } catch (error) {
        console.warn('Failed to load audio buffer.', { path, error });
        return null;
      } finally {
        audioBufferPromises.delete(path);
      }
    })();

    audioBufferPromises.set(path, pending);
  }

  return pending;
}

function playWithHtmlAudio(path: string, volume: number) {
  if (typeof document === 'undefined') return;

  const pool = getHtmlAudioPool(path);
  const instance = pool.find((audio) => audio.paused || audio.ended) ?? createAndStoreAudio(path, pool);

  instance.currentTime = 0;
  instance.volume = clampVolume(volume);

  void instance.play().catch((error) => {
    console.warn('Failed to play UI sound via HTMLAudioElement.', error);
  });
}

function getHtmlAudioPool(path: string) {
  const existing = htmlAudioPools.get(path);
  if (existing) return existing;
  const created: HTMLAudioElement[] = [];
  htmlAudioPools.set(path, created);
  return created;
}

function createAndStoreAudio(path: string, pool: HTMLAudioElement[]) {
  const audio = new Audio(path);
  audio.preload = 'auto';
  pool.push(audio);
  return audio;
}

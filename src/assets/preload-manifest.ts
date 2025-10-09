import { WORLD_STATIC } from '../domain/world/data';

export type PreloadPriority = 'critical' | 'recommended' | 'deferred';

export type PreloadEntryType = 'image' | 'audio' | 'font' | 'data' | 'other';

export type PreloadEntry = {
  url: string;
  type: PreloadEntryType;
  note?: string;
};

export type PreloadManifest = Record<PreloadPriority, PreloadEntry[]>;

type WorldAssetBuckets = {
  backgrounds: string[];
  audio: string[];
};

function createEntry(url: string, type: PreloadEntryType, note?: string): PreloadEntry {
  return { url, type, note };
}

function collectWorldAssets(): WorldAssetBuckets {
  const backgrounds = new Set<string>();
  const audio = new Set<string>();

  for (const map of WORLD_STATIC.maps) {
    if (map.bg?.path) backgrounds.add(map.bg.path);
    if (map.music?.tracks) {
      for (const track of map.music.tracks) {
        if (track) audio.add(track);
      }
    }
    for (const field of map.fields ?? []) {
      if (field.bg?.path) backgrounds.add(field.bg.path);
      if (field.musicCue?.tracks) {
        for (const track of field.musicCue.tracks) {
          if (track) audio.add(track);
        }
      }
    }
  }

  return { backgrounds: [...backgrounds], audio: [...audio] };
}

const CURSOR_FILES = [
  'lantern-default.png',
  'lantern-pointer.png',
  'lantern-click.png',
  'lantern-text.png',
  'lantern-progress.png',
  'lantern-crosshair.png',
  'lantern-disabled.png',
  'lantern-move.png',
].map((file) => createEntry(`/assets/cursors/${file}`, 'image', 'UI cursor'));

const UI_AUDIO = [
  createEntry('/assets/audio/ui/ui-click.mp3', 'audio', 'UI click'),
  createEntry('/assets/audio/ui/ui-hover.mp3', 'audio', 'UI hover'),
];

const LOBBY_MEDIA = [
  createEntry('/assets/bg/theme.png', 'image', 'Main lobby background'),
  createEntry('/assets/bg/lobby.gif', 'image', 'Animated lobby background'),
  createEntry('/assets/audio/lobby/main-theme.wav', 'audio', 'Lobby music (wav)'),
  createEntry('/assets/audio/lobby/main-theme.mp3', 'audio', 'Lobby music (mp3)'),
];

const EFFECTS = [
  createEntry('/assets/fx/light-mask.png', 'image', 'Light overlay'),
  createEntry('/assets/fx/fog-mask.png', 'image', 'Fog overlay'),
];

const ICONS = [
  'mission.svg',
  'signal.svg',
  'smart.svg',
  'fast.svg',
  'stage.svg',
  'chat.svg',
  'hasty.svg',
].map((file) => createEntry(`/assets/icons/${file}`, 'image', 'UI icon'));

const TOKENS = [
  'token-pc.svg',
  'token-npc.svg',
  'token-faction.svg',
].map((file) => createEntry(`/assets/tokens/${file}`, 'image', 'Token placeholder'));

const { backgrounds: worldBackgroundsRaw, audio: worldAudioRaw } = collectWorldAssets();

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg']);
const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.wav', '.mp3']);

function getExtension(path: string): string {
  const index = path.lastIndexOf('.');
  if (index === -1) return '';
  return path.slice(index).toLowerCase();
}

const worldBackgrounds = worldBackgroundsRaw.filter((url) =>
  SUPPORTED_IMAGE_EXTENSIONS.has(getExtension(url))
);
const worldAudio = worldAudioRaw.filter((url) => SUPPORTED_AUDIO_EXTENSIONS.has(getExtension(url)));

const WORLD_BACKGROUND_ENTRIES = worldBackgrounds.map((url) =>
  createEntry(url, 'image', 'World background'),
);
const WORLD_AUDIO_ENTRIES = worldAudio.map((url) => createEntry(url, 'audio', 'World ambience'));

const RECOMMENDED_EXTRA = [
  createEntry('/assets/grids/isometric-grid.png', 'image', 'Isometric grid overlay'),
  createEntry('/assets/grids/top-down-grid.png', 'image', 'Top-down grid overlay'),
];

const DEFERRED_PLACEHOLDERS: PreloadEntry[] = [];

export const preloadManifest: PreloadManifest = {
  critical: [
    ...CURSOR_FILES,
    ...UI_AUDIO,
    ...LOBBY_MEDIA,
    ...EFFECTS,
    ...ICONS,
    ...TOKENS,
  ],
  recommended: [
    ...WORLD_BACKGROUND_ENTRIES,
    ...WORLD_AUDIO_ENTRIES,
    ...RECOMMENDED_EXTRA,
  ],
  deferred: [...DEFERRED_PLACEHOLDERS],
};

export function listAllPreloadEntries(priorities: PreloadPriority[] = ['critical', 'recommended', 'deferred']): PreloadEntry[] {
  const seen = new Set<string>();
  const out: PreloadEntry[] = [];
  for (const priority of priorities) {
    for (const entry of preloadManifest[priority]) {
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      out.push(entry);
    }
  }
  return out;
}

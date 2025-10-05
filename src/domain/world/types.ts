export type WorldId = string;
export type MapId = string;
export type FieldId = string;

export type ThemeSpec = {
  tag: 'dark-cyber-worn-teal' | string;
  primary?: string;
  accent?: string;
  mood?: string;
};

export type BackgroundImageSpec = {
  path: string;
  position?: string;
  focalPoint?: string;
  parallax?: number;
  overlay?: 'none' | 'fog' | 'scanlines' | 'grain';
  grade?: 'cool' | 'neutral' | 'warm';
  description?: string; // LLM-ready: 장면, 조명, 색, 재질, 날씨, 디테일을 구체적으로 기술
  gifRecommended?: boolean; // 역동 연출(수면/안개/네온 깜빡임 등)이 중요하면 true
  llmPrompt?: string; // 생성용 프롬프트(선택)
};

export type MusicSpec = {
  mood: string;
  tracks: string[];
  loop?: boolean;
  volume?: number;
  cuePoints?: { name: string; time: number }[];
  description?: string; // LLM-ready: 악기, 템포, 스케일, 질감, 믹스, 환경음(디테일)
  llmPrompt?: string; // 생성용 프롬프트(선택)
};

export type FieldKind =
  | 'entry'
  | 'market'
  | 'district'
  | 'interior'
  | 'infrastructure'
  | 'ruin'
  | 'docks'
  | 'junction'
  | 'vault';

export type FieldNode = {
  id: FieldId;
  name: string;
  kind: FieldKind;
  description: string;
  neighbors: FieldId[];
  theme?: ThemeSpec;
  bg?: BackgroundImageSpec;
  musicCue?: MusicSpec;
};

export type MapNode = {
  id: MapId;
  name: string;
  description: string;
  entryFieldId: FieldId;
  prev: MapId | null;
  next: MapId | null;
  theme: ThemeSpec;
  bg: BackgroundImageSpec;
  music: MusicSpec;
  fields: FieldNode[];
};

export type WorldIndex = {
  id: WorldId;
  name: string;
  head: MapId;
  maps: MapNode[];
};

// Quest domain types — client-only (host-authoritative)
export type QuestStatus = 'not_started' | 'active' | 'completed' | 'failed';

export type ObjectiveKind =
  | 'visit'      // reach a location
  | 'interact'   // interact with an object
  | 'talk'       // talk to an NPC/topic
  | 'collect'    // collect items
  | 'deliver'    // deliver items to NPC
  | 'defeat'     // defeat target(s)
  | 'useItem'    // use an item
  | 'craft'      // craft a recipe
  | 'trigger';   // custom scripted trigger

export type Objective = {
  id: string;
  kind: ObjectiveKind;
  target?: string; // locationId | objectId | npcId | itemId | targetId | recipeId | topicId
  count?: number;  // required count (default 1)
  optional?: boolean;
  description?: string;
};

export type Stage = {
  id: string;
  title: string;
  objectives: Objective[];
  // next stage id or conditional branching
  next?: string | Array<{ cond: string; to: string }>;
};

export type Quest = {
  id: string;
  title: string;
  summary?: string;
  stages: Stage[];
  rewards?: Array<{ kind: 'item' | 'xp' | 'flag'; id?: string; amount?: number; flag?: string }>;
  repeatable?: boolean;
  hidden?: boolean;
};

export type ObjectiveProgress = {
  id: string;
  progress: number;
  done: boolean;
};

export type QuestProgress = {
  id: string;
  status: QuestStatus;
  stageIdx: number; // -1: before first stage
  objectives: ObjectiveProgress[];
  updatedAt: number;
};

export type QuestSnapshot = {
  activeQuestId: string | null;
  quests: QuestProgress[];
  updatedAt: number;
};

export type QuestCatalog = Record<string, Quest>;


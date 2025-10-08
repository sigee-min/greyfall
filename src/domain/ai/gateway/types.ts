import type { LlmManagerKind } from '../../../llm/llm-engine';
import type { SectionBundle } from '../../../llm/spec/prompts';
import type { EligibilityInput } from './eligibility';

export type AIGatewayRequestType =
  | 'chat'
  | 'intent.plan'
  | 'result.narrate'
  | 'rules.extract'
  | 'rules.narrate'
  | 'scene.brief'
  | 'scene.detail'
  | 'turn.summarize'
  | 'session.summarize'
  | 'npc.reply'
  | 'npc.name'
  | 'entity.link'
  | 'intent.disambiguate'
  | 'turn.suggest'
  | 'scene.hazard.tag'
  | 'safety.screen';

export type AIGatewayParams = {
  manager: LlmManagerKind;
  requestType: AIGatewayRequestType;
  actorId: string;
  userInstruction: string;
  contextText?: string;
  persona?: string;
  locale?: 'ko' | 'en';
  temperature?: number;
  maxTokens?: number;
  fallbackChatText?: string;
  timeoutMs?: number;
  twoPhase?: boolean;
  sections?: SectionBundle; // Optional: additional system sections to include
  eligibility?: EligibilityInput; // Optional: build sections from actor snapshots/rules
};

export type GatewayResolvedConfig = {
  maxTokens: number;
  effectiveTimeout: number;
  coldStartTimeout: number;
  useTwoPhase: boolean;
};

import type { LlmManagerKind } from '../../../llm/llm-engine';

export type AIGatewayParams = {
  manager: LlmManagerKind;
  userInstruction: string;
  contextText?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackChatText?: string;
  timeoutMs?: number;
  twoPhase?: boolean;
};

export type GatewayResolvedConfig = {
  maxTokens: number;
  effectiveTimeout: number;
  coldStartTimeout: number;
  useTwoPhase: boolean;
};

import type { ChatMessage } from '../../domain/ai/gateway/llm-exec';
import type { ToolsHost } from '../tools/types';

export type PipelineCtx = {
  user: string;
  manager: 'fast' | 'smart';
  signal?: AbortSignal;
  // Free-form scratch space to pass intermediate artifacts between steps
  scratch: Record<string, unknown>;
  // Tools host for MCP-like tools (character/map/rulebook/chat-history etc.)
  tools?: ToolsHost;
};

export type NodeTemplate = {
  id: string;
  doc?: string;
  // Templated prompts (system required, user optional — appended to the user's message)
  prompt: {
    systemTpl: string;
    userTpl?: string;
    stop?: string[];
  };
  options?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutMs?: number;
    retries?: number;
  };
  inputSpec?: Record<string, 'string' | 'number' | 'json'>;
  // Optional validator to post-process/repair model output per node
  validate?: (raw: string, ctx: PipelineCtx) => Promise<{ ok: boolean; fixed?: string; error?: string }>;
};

export type Step = {
  id: string;
  nodeId: string;
  // Params resolver can be async to allow tool calls before templating
  params: (ctx: PipelineCtx) => Promise<Record<string, unknown>> | Record<string, unknown>;
  next?: Step | null;
  onErrorNext?: Step | null;
};

export type NodeRegistry = {
  get(nodeId: string): NodeTemplate | null;
};

export type MessageExecutor = (messages: ChatMessage[], opts: {
  temperature: number; maxTokens: number; timeoutMs: number; signal?: AbortSignal;
}) => Promise<string>;

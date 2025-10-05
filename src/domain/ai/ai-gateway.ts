import { commandRegistry } from './command-registry';
import { parseAICommand, type AICommand } from './ai-router';
import { generateQwenChat } from '../../llm/qwen-webgpu';
import type { LlmManagerKind } from '../../llm/qwen-webgpu';
import { getPersona } from './personas';

export type AIGatewayParams = {
  manager: LlmManagerKind;
  userInstruction: string;
  contextText?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackChatText?: string;
};

export async function requestAICommand({
  manager,
  userInstruction,
  contextText,
  temperature = 0.5,
  maxTokens = 128,
  fallbackChatText = '채널에 합류했습니다.'
}: AIGatewayParams): Promise<AICommand> {
  const persona = getPersona(manager);
  const capabilities = commandRegistry
    .list()
    .map((c) => `- ${c.cmd}: ${c.doc}`)
    .join('\n');

  const sys = [
    `당신은 작전 안내인 "${persona.name}"입니다.`,
    ...persona.systemDirectives,
    '가능한 명령과 설명:',
    capabilities,
    '',
    '출력은 반드시 JSON 한 줄로만 작성:',
    '{"cmd": "<명령>", "body": <고정타입>}',
    '각 명령의 body는 고정 타입을 따릅니다(예: chat → string).',
  ].join('\n');

  const user = [
    userInstruction,
    contextText ? '' : undefined,
    contextText ? '맥락:' : undefined,
    contextText ?? undefined
  ]
    .filter(Boolean)
    .join('\n');

  let raw = '';
  try {
    raw = (await generateQwenChat(user, { systemPrompt: sys, temperature, maxTokens })).trim();
  } catch (e) {
    // Fall through and return fallback command
  }
  const parsed = parseAICommand(raw);
  if (parsed) return parsed;
  return { cmd: 'chat', body: { text: fallbackChatText } };
}

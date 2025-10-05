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
    // Log error for visibility, then fall back to a safe command to keep UX responsive.
    const message = e instanceof Error ? e.message : String(e);
    // Avoid logging full prompt to reduce noise/PII; include minimal context.
    console.error('[ai-gateway] LLM request failed; using fallback', {
      manager,
      temperature,
      maxTokens,
      error: message
    });
  }
  const parsed = parseAICommand(raw);
  if (parsed) return parsed;
  if (raw) {
    // Received output but could not parse the expected JSON envelope
    const preview = typeof raw === 'string' ? raw.slice(0, 160) : String(raw);
    console.warn('[ai-gateway] Unparseable LLM output; falling back to chat', { preview });
  } else {
    console.warn('[ai-gateway] Empty LLM output; falling back to chat');
  }
  return { cmd: 'chat', body: { text: fallbackChatText } };
}

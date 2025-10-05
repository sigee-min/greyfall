import { nanoid } from 'nanoid';
import { z } from 'zod';
import { commandRegistry, type CommandContext, type AICommandEnvelope } from './command-registry.js';
import { ChatCommand } from './commands/chat.js';
import { MissionStartCommand } from './commands/mission-start.js';
import { ReadyzCommand } from './commands/readyz.js';

export type AICommand = { cmd: string; body?: unknown };

const EnvelopeSchema = z.object({ cmd: z.string().min(1), body: z.any().optional() }).passthrough();

const DEBUG = Boolean((import.meta as any).env?.VITE_LLM_DEBUG);

function stripThinkBlocks(input: string): string {
  return input.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractFencedJson(input: string): string | null {
  const m = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : null;
}

function extractFirstJsonObject(input: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        return input.slice(start, i + 1).trim();
      }
    }
  }
  return null;
}

export function parseAICommand(text: string): AICommand | null {
  const log = (...args: unknown[]) => DEBUG && console.debug('[ai-parser]', ...args);
  const original = String(text ?? '');
  log('raw', original);
  // 1) direct parse
  try {
    const obj = JSON.parse(original) as unknown;
    const parsed = EnvelopeSchema.safeParse(obj);
    if (parsed.success) return { cmd: parsed.data.cmd, body: parsed.data.body };
  } catch {}

  // 2) cleanup and relaxed extraction
  let working = stripThinkBlocks(original);
  const fenced = extractFencedJson(working);
  if (fenced) working = fenced;
  const jsonSlice = extractFirstJsonObject(working) ?? working.trim();
  log('cleaned', jsonSlice.slice(0, 240));
  try {
    const obj = JSON.parse(jsonSlice) as unknown;
    const parsed = EnvelopeSchema.safeParse(obj);
    if (parsed.success) return { cmd: parsed.data.cmd, body: parsed.data.body };
  } catch (err) {
    log('parse-failed', (err as Error)?.message ?? String(err));
  }
  return null;
}

// one-time registration for built-in commands
let initialised = false;
function ensureRegistry() {
  if (initialised) return;
  commandRegistry.register(ChatCommand);
  commandRegistry.register(MissionStartCommand);
  commandRegistry.register(ReadyzCommand);
  initialised = true;
}

export async function executeAICommand(command: AICommand, ctx: CommandContext): Promise<boolean> {
  ensureRegistry();
  const envelope: AICommandEnvelope = { id: nanoid(12), cmd: command.cmd, body: command.body };
  return await commandRegistry.execute(envelope, ctx);
}

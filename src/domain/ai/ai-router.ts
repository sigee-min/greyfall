import { nanoid } from 'nanoid';
import { z } from 'zod';
import { commandRegistry, type CommandContext, type AICommandEnvelope } from './command-registry.js';
import { ChatCommand } from './commands/chat.js';

export type AICommand = { cmd: string; body?: unknown };

const EnvelopeSchema = z.object({ cmd: z.string().min(1), body: z.any().optional() }).passthrough();

export function parseAICommand(text: string): AICommand | null {
  try {
    const obj = JSON.parse(text) as unknown;
    const parsed = EnvelopeSchema.safeParse(obj);
    if (!parsed.success) return null;
    return { cmd: parsed.data.cmd, body: parsed.data.body };
  } catch {
    return null;
  }
}

// one-time registration for built-in commands
let initialised = false;
function ensureRegistry() {
  if (initialised) return;
  commandRegistry.register(ChatCommand);
  initialised = true;
}

export async function executeAICommand(command: AICommand, ctx: CommandContext): Promise<boolean> {
  ensureRegistry();
  const envelope: AICommandEnvelope = { id: nanoid(12), cmd: command.cmd, body: command.body };
  return await commandRegistry.execute(envelope, ctx);
}

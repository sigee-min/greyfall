import { nanoid } from 'nanoid';
import { z } from 'zod';
import { commandRegistry } from './command-registry.js';
import { ChatCommand } from './commands/chat.js';
import { MissionStartCommand } from './commands/mission-start.js';
import { ReadyzCommand } from './commands/readyz.js';
const EnvelopeSchema = z.object({ cmd: z.string().min(1), body: z.any().optional() }).passthrough();
export function parseAICommand(text) {
    try {
        const obj = JSON.parse(text);
        const parsed = EnvelopeSchema.safeParse(obj);
        if (!parsed.success)
            return null;
        return { cmd: parsed.data.cmd, body: parsed.data.body };
    }
    catch {
        return null;
    }
}
// one-time registration for built-in commands
let initialised = false;
function ensureRegistry() {
    if (initialised)
        return;
    commandRegistry.register(ChatCommand);
    commandRegistry.register(MissionStartCommand);
    commandRegistry.register(ReadyzCommand);
    initialised = true;
}
export async function executeAICommand(command, ctx) {
    ensureRegistry();
    const envelope = { id: nanoid(12), cmd: command.cmd, body: command.body };
    return await commandRegistry.execute(envelope, ctx);
}

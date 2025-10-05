import { z } from 'zod';
import type { PublishLobbyMessage } from '../chat/use-lobby-chat';
import type { SessionParticipant } from '../session/types';
import type { LlmManagerKind } from '../../llm/qwen-webgpu';

export type CommandContext = {
  manager: LlmManagerKind;
  publishLobbyMessage: PublishLobbyMessage;
  participants: SessionParticipant[];
  localParticipantId: string | null;
};

export type AICommandEnvelope = {
  id: string;
  cmd: string;
  body?: unknown;
};

export type CommandPolicy = {
  role?: 'host' | 'guest' | 'any';
  cooldownMs?: number;
};

export type CommandSpec<T = unknown> = {
  cmd: string;
  schema: z.ZodType<T>;
  doc: string;
  policy?: CommandPolicy;
  coerce?: (raw: unknown) => unknown;
  handler: (args: T, ctx: CommandContext) => boolean | Promise<boolean>;
};

class Registry {
  private specs = new Map<string, CommandSpec<unknown>>();
  private lastExecAt = new Map<string, number>();

  register<T>(spec: CommandSpec<T>) {
    this.specs.set(spec.cmd.toLowerCase(), spec as unknown as CommandSpec<unknown>);
  }

  list(): CommandSpec<unknown>[] {
    return [...this.specs.values()];
  }

  get(cmd: string): CommandSpec<unknown> | undefined {
    return this.specs.get(cmd.toLowerCase());
  }

  async execute(envelope: AICommandEnvelope, ctx: CommandContext): Promise<boolean> {
    const spec = this.get(envelope.cmd);
    if (!spec) {
      console.warn('[ai] unknown command', envelope.cmd);
      return false;
    }
    const raw = spec.coerce ? spec.coerce(envelope.body) : envelope.body;
    const parsed = (spec.schema as z.ZodType<unknown>).safeParse(raw);
    if (!parsed.success) {
      console.warn('[ai] invalid command body', { cmd: envelope.cmd, issues: parsed.error.issues });
      return false;
    }

    if (!this.checkPolicy(spec.policy, ctx)) {
      console.warn('[ai] policy denied', { cmd: envelope.cmd, policy: spec.policy });
      return false;
    }

    const now = Date.now();
    if (spec.policy?.cooldownMs) {
      const key = spec.cmd.toLowerCase();
      const last = this.lastExecAt.get(key) ?? 0;
      if (now - last < spec.policy.cooldownMs) {
        console.info('[ai] cooldown active', { cmd: spec.cmd });
        return false;
      }
      this.lastExecAt.set(key, now);
    }

    try {
      return await (spec.handler as (args: unknown, ctx: CommandContext) => Promise<boolean> | boolean)(
        parsed.data,
        ctx
      );
    } catch (err) {
      console.error('[ai] handler failed', { cmd: spec.cmd, err });
      return false;
    }
  }

  private checkPolicy(policy: CommandPolicy | undefined, ctx: CommandContext): boolean {
    if (!policy || policy.role === 'any' || !policy.role) return true;
    const me = ctx.participants.find((p) => p.id === ctx.localParticipantId);
    if (!me) return false;
    if (policy.role === 'host') return me.role === 'host';
    if (policy.role === 'guest') return me.role === 'guest';
    return true;
  }
}

export const commandRegistry = new Registry();

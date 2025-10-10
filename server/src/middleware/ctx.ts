import type { IncomingMessage } from 'node:http';

export type RequestContext = { reqId: string; startedAt: number };

const CTX_SYMBOL = Symbol('greyfall.ctx');

export function attachContext(req: IncomingMessage, ctx: RequestContext): void {
  (req as any)[CTX_SYMBOL as any] = ctx;
}

export function getContext(req: IncomingMessage): RequestContext | null {
  return (((req as any)[CTX_SYMBOL as any]) as RequestContext) ?? null;
}

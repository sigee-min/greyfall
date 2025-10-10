import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodSchema } from 'zod';
import { validate } from './validate.js';
import { sendError } from './http.js';
import { parseBody } from '../utils.js';

export type RouteCtx = { pathname: string; query: Record<string, unknown> };

export type RouteOptions<Q = unknown, B = unknown> = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string | RegExp | ((pathname: string) => boolean);
  querySchema?: ZodSchema<Q>;
  bodySchema?: ZodSchema<B>;
};

export async function route<Q = any, B = any>(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteCtx,
  opts: RouteOptions<Q, B>,
  handler: (args: { query: Q; body: B; ctx: RouteCtx }) => Promise<void> | void
): Promise<boolean> {
  if (req.method !== opts.method) return false;
  const match =
    typeof opts.path === 'string'
      ? ctx.pathname === opts.path
      : opts.path instanceof RegExp
        ? opts.path.test(ctx.pathname)
        : opts.path(ctx.pathname);
  if (!match) return false;
  try {
    const query = opts.querySchema ? (validate(opts.querySchema, ctx.query) as Q) : ((ctx.query as unknown) as Q);
    const body = opts.bodySchema
      ? (validate(opts.bodySchema, await parseBody<any>(req)) as B)
      : ((undefined as unknown) as B);
    await handler({ query, body, ctx });
  } catch (e: any) {
    sendError(res, { code: 'VALIDATION_ERROR', status: 400, details: e?.details });
  }
  return true;
}


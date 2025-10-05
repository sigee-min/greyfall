import { z } from 'zod';

export const patchOpBase = z.object({
  path: z.string().min(1).optional(),
  value: z.any().optional()
});

export const patchOpSet = patchOpBase.extend({ op: z.literal('set') });
export const patchOpMerge = patchOpBase.extend({ op: z.literal('merge') });
export const patchOpInsert = patchOpBase.extend({ op: z.literal('insert') });
export const patchOpRemove = patchOpBase.extend({ op: z.literal('remove') });

export const patchOpSchema = z.union([patchOpSet, patchOpMerge, patchOpInsert, patchOpRemove]);

export const patchBodySchema = z.object({
  id: z.string().min(1),
  rev: z.number().int().nonnegative(),
  ops: z.array(patchOpSchema).nonempty()
});

export const replaceBodySchema = z.object({
  id: z.string().min(1),
  rev: z.number().int().nonnegative(),
  value: z.any()
});

export const requestBodySchema = z.object({
  id: z.string().min(1),
  sinceRev: z.number().int().nonnegative().optional()
});

export type PatchOp = z.infer<typeof patchOpSchema>;
export type PatchBody = z.infer<typeof patchBodySchema>;
export type ReplaceBody = z.infer<typeof replaceBodySchema>;
export type RequestBody = z.infer<typeof requestBodySchema>;


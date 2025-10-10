import type { ZodSchema } from 'zod';

export function validate<T>(schema: ZodSchema<T>, source: unknown): T {
  const result = (schema as any).safeParse(source) as { success: boolean; data?: T; error?: unknown };
  if (!result.success) {
    const details = (result as any).error?.errors ?? result.error;
    const err = new Error('VALIDATION_ERROR');
    (err as any).details = details;
    throw err;
  }
  return result.data as T;
}


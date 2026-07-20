import type { ZodError, ZodType } from 'zod';

export type EntityListOptions = {
  limit?: number;
  offset?: number;
};

export function formatValidationError(error: ZodError, fallback = 'Details are invalid.') {
  return error.issues[0]?.message || fallback;
}

export function parseEntityInput<T>(schema: ZodType<T>, input: unknown, fallback?: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(formatValidationError(result.error, fallback));
  }

  return result.data;
}

export function softDeletePayload(date = new Date()) {
  return { deleted_at: date.toISOString() };
}

export function restorePayload() {
  return { deleted_at: null };
}

export function rangeFromOptions(options: EntityListOptions = {}) {
  if (!options.limit || options.limit <= 0) {
    return null;
  }

  const from = options.offset ?? 0;
  return {
    from,
    to: from + options.limit - 1
  };
}

import {z} from 'zod';
import {AppError} from './errors.js';

const cursorSchema = z.object({createdAt: z.string().datetime(), id: z.string().uuid()});

export type Cursor = z.infer<typeof cursorSchema>;

export const encodeCursor = (cursor: Cursor): string => Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

export const decodeCursor = (value: string | undefined): Cursor | undefined => {
  if (!value) return undefined;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
};

export const pageLimit = (value: unknown, fallback = 30, maximum = 100): number => {
  const parsed = z.coerce.number().int().positive().max(maximum).safeParse(value ?? fallback);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', `Limit must be between 1 and ${maximum}.`);
  return parsed.data;
};

import { z } from 'zod';
import { resolveTimeZone } from './time-zone';

export const timeZoneQuerySchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const resolved = resolveTimeZone(value);

    if (resolved === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid IANA time zone',
      });
      return z.NEVER;
    }

    return resolved;
  });

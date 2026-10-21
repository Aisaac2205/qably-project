import { z } from 'zod';

/**
 * An empty variable counts as unset, so a blank value in the hosting
 * dashboard or a bare `KEY=` line in `.env` keeps the default (or stays
 * absent) instead of failing the schema and aborting startup.
 */
const blankAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const optionalSecret = blankAsUnset(z.string().min(1).optional());

const httpUrl = z
  .url()
  .refine(
    (value) => {
      try {
        return /^https?:$/.test(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: 'must be an absolute http(s) url' },
  )
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return (
          parsed.pathname === '/' && parsed.search === '' && parsed.hash === ''
        );
      } catch {
        return false;
      }
    },
    { message: 'must be a bare origin with no path, query or fragment' },
  );

/**
 * Test files one ingestion batch (one push, for one project) may send to AI
 * extraction before the whole batch is skipped.
 */
const DEFAULT_EXTRACTION_MAX_FILES_PER_BATCH = 50;

const extractionMaxFilesPerBatch = blankAsUnset(
  z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_EXTRACTION_MAX_FILES_PER_BATCH),
);

const envSchema = z.object({
  NODE_ENV: blankAsUnset(
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  PORT: blankAsUnset(z.coerce.number().int().positive().default(3001)),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: httpUrl,
  WEB_APP_URL: httpUrl,
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: blankAsUnset(
    z.string().min(1).default('gemini-3.1-flash-lite'),
  ),
  AERIS_DAILY_BUDGET: blankAsUnset(
    z.coerce.number().int().positive().optional(),
  ),
  EXTRACTION_MAX_FILES_PER_BATCH: extractionMaxFilesPerBatch,
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM_EMAIL: blankAsUnset(z.string().min(1).optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${details}`);
  }

  return result.data;
}

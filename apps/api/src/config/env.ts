import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

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

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: httpUrl,
  WEB_APP_URL: httpUrl,
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM_EMAIL: z.string().min(1).optional(),
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

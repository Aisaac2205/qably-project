import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Env } from './env';
import { resolveAllowedOrigins } from './origins';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

export function buildCorsOptions(env: Pick<Env, 'WEB_APP_URL'>): CorsOptions {
  return {
    origin: resolveAllowedOrigins(env.WEB_APP_URL),
    credentials: true,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  };
}

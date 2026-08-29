import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { Env } from '../../config/env';
import type { PrismaService } from '../../prisma/prisma.service';
import { buildAuthOptions } from './auth.options';

export type AuthInstance = ReturnType<typeof createAuth>;

export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

export function createAuth(prisma: PrismaService, env: Env) {
  return betterAuth({
    ...buildAuthOptions(env),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
  });
}

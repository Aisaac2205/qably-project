import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { Env } from '../../config/env';
import type { EmailSender } from '../mailer/mailer.contracts';
import type { PrismaService } from '../../prisma/prisma.service';
import { buildAuthOptions } from './auth.options';

export type AuthInstance = ReturnType<typeof createAuth>;

export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

export function createAuth(
  prisma: PrismaService,
  env: Env,
  mailer: EmailSender,
) {
  return betterAuth({
    ...buildAuthOptions(env, mailer),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
  });
}

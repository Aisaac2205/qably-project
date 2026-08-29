import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_READER } from './auth.contracts';
import { AuthController } from './auth.controller';
import { AUTH_INSTANCE, createAuth } from './auth.instance';
import { BetterAuthSessionReader } from './better-auth-session.reader';
import { SessionGuard } from './guards/session.guard';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [PrismaService, ENV],
      useFactory: (prisma: PrismaService, env: Env) => createAuth(prisma, env),
    },
    { provide: SESSION_READER, useClass: BetterAuthSessionReader },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AUTH_INSTANCE, SESSION_READER],
})
export class AuthModule {}

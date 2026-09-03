import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerModule } from '../mailer/mailer.module';
import { MailerService } from '../mailer/mailer.service';
import { SESSION_READER } from './auth.contracts';
import { AuthController } from './auth.controller';
import { AUTH_INSTANCE, createAuth } from './auth.instance';
import { BetterAuthSessionReader } from './better-auth-session.reader';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [MailerModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [PrismaService, ENV, MailerService],
      useFactory: (prisma: PrismaService, env: Env, mailer: MailerService) =>
        createAuth(prisma, env, mailer),
    },
    { provide: SESSION_READER, useClass: BetterAuthSessionReader },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AUTH_INSTANCE, SESSION_READER],
})
export class AuthModule {}

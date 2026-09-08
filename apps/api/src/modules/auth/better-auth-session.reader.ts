import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Locale } from '@qably/i18n';
import type { IncomingHttpHeaders } from 'node:http';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionContext, SessionReader } from './auth.contracts';
import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';

function toLocale(value: string | null | undefined): Locale | null {
  return value === 'en' || value === 'es' ? value : null;
}

@Injectable()
export class BetterAuthSessionReader implements SessionReader {
  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
    private readonly prisma: PrismaService,
  ) {}

  async read(headers: Record<string, unknown>): Promise<SessionContext | null> {
    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers as IncomingHttpHeaders),
    });

    if (result === null) return null;

    const locale = await this.resolveLocale(result.user.id);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        emailVerified: result.user.emailVerified,
        locale,
      },
      sessionId: result.session.id,
      expiresAt: result.session.expiresAt,
    };
  }

  private async resolveLocale(userId: string): Promise<Locale | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });

    return toLocale(row?.locale);
  }
}

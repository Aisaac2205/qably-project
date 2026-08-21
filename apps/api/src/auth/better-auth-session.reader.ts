import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { SessionContext, SessionReader } from './auth.contracts';
import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';

@Injectable()
export class BetterAuthSessionReader implements SessionReader {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  async read(headers: Record<string, unknown>): Promise<SessionContext | null> {
    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers as IncomingHttpHeaders),
    });

    if (result === null) return null;

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        emailVerified: result.user.emailVerified,
      },
      sessionId: result.session.id,
      expiresAt: result.session.expiresAt,
    };
  }
}

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SESSION_READER,
  type RequestWithSession,
  type SessionContext,
  type SessionReader,
} from '../auth.contracts';
import { IS_PUBLIC } from '../decorators/public.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(
    @Inject(SESSION_READER) private readonly sessionReader: SessionReader,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const session = await this.readSession(request);

    if (session === null)
      throw new UnauthorizedException('Authentication required');

    request.session = session;
    return true;
  }

  private async readSession(
    request: RequestWithSession,
  ): Promise<SessionContext | null> {
    try {
      return await this.sessionReader.read(request.headers);
    } catch (error) {
      this.logger.error(
        'Session lookup failed',
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }
}

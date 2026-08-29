import { All, Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthenticatedUser } from './auth.contracts';
import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller()
export class AuthController {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(AUTH_INSTANCE) auth: AuthInstance) {
    this.handler = toNodeHandler(auth);
  }

  @Public()
  @All('api/auth/*path')
  handle(
    @Req() request: IncomingMessage,
    @Res() response: ServerResponse,
  ): Promise<void> {
    return this.handler(request, response);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

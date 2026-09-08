import { All, Body, Controller, Get, Inject, Patch, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PrismaService } from '../../prisma/prisma.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from './auth.contracts';
import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';
import { updateMyLocaleSchema, type UpdateMyLocaleInput } from './auth.schemas';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller()
export class AuthController {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(
    @Inject(AUTH_INSTANCE) auth: AuthInstance,
    private readonly prisma: PrismaService,
  ) {
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

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateMyLocaleSchema))
    body: UpdateMyLocaleInput,
  ): Promise<AuthenticatedUser> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { locale: body.locale },
    });

    return { ...user, locale: body.locale };
  }
}

import {
  Body,
  Controller,
  ForbiddenException,
  GoneException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { InvitePreviewRecord } from '@qably/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type {
  InviteAcceptError,
  InvitePreviewError,
} from './invites.contracts';
import { tokenSchema, type TokenInput } from './invites.schemas';
import { InvitesService } from './invites.service';

function unwrapPreview<T>(result: Result<T, InvitePreviewError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'invite-invalid-or-used':
      throw new NotFoundException({
        code: result.error,
        message: 'This invite link is no longer valid',
      });
  }
}

function unwrapAccept<T>(result: Result<T, InviteAcceptError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'invite-invalid-or-used':
      throw new NotFoundException({
        code: result.error,
        message: 'This invite link is no longer valid',
      });
    case 'invite-expired':
      throw new GoneException({
        code: result.error,
        message: 'This invite link has expired',
      });
    case 'invite-email-mismatch':
      throw new ForbiddenException({
        code: result.error,
        message: 'This invite was sent to a different email address',
      });
    case 'seat-limit-reached':
      throw new ForbiddenException({
        code: result.error,
        message: 'This organization has reached the member limit for its plan',
      });
  }
}

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Public()
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async preview(
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenInput,
  ): Promise<InvitePreviewRecord> {
    return unwrapPreview(await this.invites.previewInvite(body.token));
  }

  @Post('accept')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenInput,
  ): Promise<{ organizationId: string }> {
    return unwrapAccept(await this.invites.acceptInvite(body.token, user));
  }
}

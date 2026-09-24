import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  CreateInviteResult,
  InviteCreateError,
  InviteManageError,
  OrgInviteSummary,
} from './invites.contracts';
import { createInviteSchema, type CreateInviteInput } from './invites.schemas';
import { InvitesService } from './invites.service';

function unwrapCreate<T>(result: Result<T, InviteCreateError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'forbidden':
      throw new ForbiddenException({
        code: result.error,
        message: 'Your role cannot manage invites',
      });
    case 'seat-limit-reached':
      throw new ForbiddenException({
        code: result.error,
        message: 'This organization has reached the member limit for its plan',
      });
    case 'already-member':
      throw new ConflictException({
        code: result.error,
        message: 'This email already belongs to a member of the organization',
      });
  }
}

function unwrapManage<T>(result: Result<T, InviteManageError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'forbidden':
      throw new ForbiddenException({
        code: result.error,
        message: 'Your role cannot manage invites',
      });
    case 'not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'Invite not found',
      });
  }
}

@Controller('organizations/current/invites')
@UseGuards(OrgScopeGuard)
export class OrgInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  async list(@CurrentOrg() org: OrgContext): Promise<OrgInviteSummary[]> {
    return unwrapManage(await this.invites.listInvites(org));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteInput,
  ): Promise<CreateInviteResult> {
    return unwrapCreate(await this.invites.createInvite(org, user, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<void> {
    unwrapManage(await this.invites.revokeInvite(org, id));
  }

  @Post(':id/resend')
  async resend(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CreateInviteResult> {
    return unwrapManage(await this.invites.resendInvite(org, user, id));
  }
}

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
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { OrganizationUsageRecord } from '@qably/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from './decorators/current-org.decorator';
import { OrgScopeGuard } from './guards/org-scope.guard';
import type { MemberManageError, OrgMember } from './members.contracts';
import { changeRoleSchema, type ChangeRoleInput } from './members.schemas';
import { MembersService } from './members.service';
import type {
  OrgContext,
  OrganizationSummary,
} from './organizations.contracts';
import { OrganizationsService } from './organizations.service';

function unwrapMemberManage<T>(result: Result<T, MemberManageError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'forbidden':
      throw new ForbiddenException({
        code: result.error,
        message: 'Your role cannot manage members',
      });
    case 'not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'Member not found',
      });
    case 'last-owner-required':
      throw new ConflictException({
        code: result.error,
        message: 'The organization must keep at least one owner',
      });
  }
}

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly members: MembersService,
  ) {}

  @Get('current')
  @UseGuards(OrgScopeGuard)
  current(@CurrentOrg() org: OrgContext): OrgContext {
    return org;
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrganizationSummary[]> {
    return this.organizations.listForUser(user.id);
  }

  @Get('current/usage')
  @UseGuards(OrgScopeGuard)
  usage(@CurrentOrg() org: OrgContext): Promise<OrganizationUsageRecord> {
    return this.organizations.getUsage(org);
  }

  @Get('current/members')
  @UseGuards(OrgScopeGuard)
  async listMembers(@CurrentOrg() org: OrgContext): Promise<OrgMember[]> {
    return unwrapMemberManage(await this.members.listMembers(org));
  }

  @Patch('current/members/:memberId')
  @UseGuards(OrgScopeGuard)
  async changeRole(
    @CurrentOrg() org: OrgContext,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(changeRoleSchema)) body: ChangeRoleInput,
  ): Promise<OrgMember> {
    return unwrapMemberManage(
      await this.members.changeRole(org, memberId, body.role),
    );
  }

  @Delete('current/members/:memberId')
  @UseGuards(OrgScopeGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentOrg() org: OrgContext,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    unwrapMemberManage(await this.members.removeMember(org, memberId));
  }
}

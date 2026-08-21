import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from './decorators/current-org.decorator';
import { OrgScopeGuard } from './guards/org-scope.guard';
import type {
  OrgContext,
  OrganizationSummary,
} from './organizations.contracts';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(OrgScopeGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('current')
  current(@CurrentOrg() org: OrgContext): OrgContext {
    return org;
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrganizationSummary[]> {
    return this.organizations.listForUser(user.id);
  }
}

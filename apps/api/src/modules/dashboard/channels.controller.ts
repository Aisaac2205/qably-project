import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { DashboardChannelsRecord } from '@qably/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import {
  dashboardChannelsQuerySchema,
  type DashboardChannelsQuery,
} from './channels.schemas';
import { ChannelsService } from './channels.service';
import { unwrapDashboardError as unwrap } from './lib/unwrap-dashboard-error';

@Controller('dashboard')
@UseGuards(OrgScopeGuard)
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get('channels')
  async get(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardChannelsQuerySchema))
    query: DashboardChannelsQuery,
  ): Promise<DashboardChannelsRecord> {
    return unwrap(await this.channels.channels(org, user.id, query.tz));
  }
}

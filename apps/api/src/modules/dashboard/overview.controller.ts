import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { DashboardOverviewRecord } from '@qably/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import { unwrapDashboardError as unwrap } from './lib/unwrap-dashboard-error';
import {
  dashboardOverviewQuerySchema,
  type DashboardOverviewQuery,
} from './overview.schemas';
import { OverviewService } from './overview.service';

@Controller('dashboard')
@UseGuards(OrgScopeGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('overview')
  async get(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(dashboardOverviewQuerySchema))
    query: DashboardOverviewQuery,
  ): Promise<DashboardOverviewRecord> {
    return unwrap(
      await this.overview.overview(
        org,
        query.period,
        query.tz,
        query.projectId,
      ),
    );
  }
}

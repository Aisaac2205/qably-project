import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { TraceabilityCalendarRecord } from '@qably/types';
import type { DashboardSummaryView } from './dashboard.contracts';
import {
  dashboardSummaryQuerySchema,
  dashboardTraceabilityQuerySchema,
  type DashboardSummaryQuery,
  type DashboardTraceabilityQuery,
} from './dashboard.schemas';
import { DashboardService } from './dashboard.service';
import { unwrapDashboardError as unwrap } from './lib/unwrap-dashboard-error';

@Controller('dashboard')
@UseGuards(OrgScopeGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  async summary(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(dashboardSummaryQuerySchema))
    query: DashboardSummaryQuery,
  ): Promise<DashboardSummaryView> {
    return unwrap(await this.dashboard.summary(org, query.projectId));
  }

  @Get('traceability')
  async traceability(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(dashboardTraceabilityQuerySchema))
    query: DashboardTraceabilityQuery,
  ): Promise<TraceabilityCalendarRecord> {
    return unwrap(
      await this.dashboard.traceability(
        org,
        query.year,
        query.tz,
        query.projectId,
      ),
    );
  }
}

import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { TraceabilityCalendarRecord } from '@qably/types';
import type {
  DashboardError,
  DashboardSummaryView,
} from './dashboard.contracts';
import {
  dashboardSummaryQuerySchema,
  dashboardTraceabilityQuerySchema,
  type DashboardSummaryQuery,
  type DashboardTraceabilityQuery,
} from './dashboard.schemas';
import { DashboardService } from './dashboard.service';

function unwrap<T>(result: Result<T, DashboardError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'project-not-found':
      throw new NotFoundException('Project not found');
  }
}

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
      await this.dashboard.traceability(org, query.year, query.projectId),
    );
  }
}

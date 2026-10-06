import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import { SuiteListQueryService } from './suite-list-query.service';
import type { SuiteSummariesPage, SuiteTagsFacet } from './suites.contracts';
import {
  listSuiteSummariesQuerySchema,
  listSuiteTagsQuerySchema,
  type ListSuiteSummariesQuery,
  type ListSuiteTagsQuery,
} from './suites.schemas';

@Controller('suites')
@UseGuards(OrgScopeGuard)
export class SuiteListController {
  constructor(private readonly queries: SuiteListQueryService) {}

  @Get('summaries')
  summaries(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listSuiteSummariesQuerySchema))
    query: ListSuiteSummariesQuery,
  ): Promise<SuiteSummariesPage> {
    return this.queries.page(org, query);
  }

  @Get('tags')
  tags(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listSuiteTagsQuerySchema))
    query: ListSuiteTagsQuery,
  ): Promise<SuiteTagsFacet> {
    return this.queries.tags(org, query);
  }
}

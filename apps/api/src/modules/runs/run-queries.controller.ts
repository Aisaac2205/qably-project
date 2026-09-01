import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { RunQueryError, RunSummaryView, RunView } from './runs.contracts';
import { listRunsQuerySchema, type ListRunsQuery } from './runs.schemas';
import { RunQueriesService } from './run-queries.service';

function unwrap<T>(result: Result<T, RunQueryError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Run not found');
  }
}

@Controller('runs')
@UseGuards(OrgScopeGuard)
export class RunQueriesController {
  constructor(private readonly runs: RunQueriesService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listRunsQuerySchema)) query: ListRunsQuery,
  ): Promise<RunSummaryView[]> {
    return this.runs.list(org, query.projectId);
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<RunView> {
    return unwrap(await this.runs.findOne(org, id));
  }
}

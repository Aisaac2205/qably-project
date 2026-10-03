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
import { CiRunsService } from './ci-runs.service';
import type {
  CiRunDetailView,
  CiRunQueryError,
  CiRunsPageView,
} from './runs.contracts';
import { listCiRunsQuerySchema, type ListCiRunsQuery } from './runs.schemas';

function unwrap<T>(result: Result<T, CiRunQueryError>): T {
  if (!isErr(result)) return result.value;

  throw new NotFoundException({
    code: 'not-found',
    message: 'CI run not found',
  });
}

@Controller('ci-runs')
@UseGuards(OrgScopeGuard)
export class CiRunsController {
  constructor(private readonly ciRuns: CiRunsService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listCiRunsQuerySchema))
    query: ListCiRunsQuery,
  ): Promise<CiRunsPageView> {
    return this.ciRuns.list(org, query);
  }

  @Get(':id')
  async get(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<CiRunDetailView> {
    return unwrap(await this.ciRuns.get(org, id));
  }
}

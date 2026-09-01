import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { RunQueryError, RunSummaryView, RunView } from './runs.contracts';
import {
  createManualRunSchema,
  listRunsQuerySchema,
  updateRunCaseStatusSchema,
  type CreateManualRunInput,
  type ListRunsQuery,
  type UpdateRunCaseStatusInput,
} from './runs.schemas';
import { RunQueriesService } from './run-queries.service';

function unwrap<T>(result: Result<T, RunQueryError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Run not found');
    case 'case-not-found':
      throw new NotFoundException('Case not found in this run');
    case 'suite-not-found':
      throw new NotFoundException('Suite not found for this project');
    case 'empty-suite':
      throw new BadRequestException(
        'Cannot start a run from a suite with no cases',
      );
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createManualRunSchema))
    body: CreateManualRunInput,
  ): Promise<RunView> {
    return unwrap(await this.runs.createManual(org, user, body));
  }

  @Patch(':runId/cases/:caseId')
  async updateCaseStatus(
    @CurrentOrg() org: OrgContext,
    @Param('runId') runId: string,
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(updateRunCaseStatusSchema))
    body: UpdateRunCaseStatusInput,
  ): Promise<RunView> {
    return unwrap(await this.runs.updateCaseStatus(org, runId, caseId, body));
  }
}

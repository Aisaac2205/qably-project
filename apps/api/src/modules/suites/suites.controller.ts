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
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { SuiteError, SuiteView } from './suites.contracts';
import {
  createCaseSchema,
  createSuiteSchema,
  listSuitesQuerySchema,
  updateCaseSchema,
  updateSuiteSchema,
  type CreateCaseInput,
  type CreateSuiteInput,
  type ListSuitesQuery,
  type UpdateCaseInput,
  type UpdateSuiteInput,
} from './suites.schemas';
import { SuitesService } from './suites.service';

function unwrap<T>(result: Result<T, SuiteError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Suite not found');
    case 'name-taken':
      throw new ConflictException(
        'A suite with that name already exists in this project',
      );
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('suites')
@UseGuards(OrgScopeGuard)
export class SuitesController {
  constructor(private readonly suites: SuitesService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listSuitesQuerySchema)) query: ListSuitesQuery,
  ): Promise<SuiteView[]> {
    return this.suites.list(org, query.projectId);
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<SuiteView> {
    return unwrap(await this.suites.findOne(org, id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(createSuiteSchema)) body: CreateSuiteInput,
  ): Promise<SuiteView> {
    return unwrap(await this.suites.create(org, body));
  }

  @Patch(':id')
  async update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSuiteSchema)) body: UpdateSuiteInput,
  ): Promise<SuiteView> {
    return unwrap(await this.suites.update(org, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<void> {
    unwrap(await this.suites.remove(org, id));
  }

  @Post(':id/cases')
  @HttpCode(HttpStatus.CREATED)
  async addCase(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCaseSchema)) body: CreateCaseInput,
  ): Promise<SuiteView> {
    return unwrap(await this.suites.addCase(org, id, body));
  }

  @Patch(':id/cases/:caseId')
  async updateCase(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(updateCaseSchema)) body: UpdateCaseInput,
  ): Promise<SuiteView> {
    return unwrap(await this.suites.updateCase(org, id, caseId, body));
  }

  @Delete(':id/cases/:caseId')
  async removeCase(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Param('caseId') caseId: string,
  ): Promise<SuiteView> {
    return unwrap(await this.suites.removeCase(org, id, caseId));
  }
}

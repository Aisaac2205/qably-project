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
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ProjectError,
  ProjectListView,
  ProjectView,
} from './projects.contracts';
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './projects.schemas';
import { ProjectsService } from './projects.service';

function unwrap<T>(result: Result<T, ProjectError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Project not found');
    case 'name-taken':
      throw new ConflictException(
        'A project with that name already exists in this organization',
      );
    case 'plan-limit-reached':
      throw new ForbiddenException(
        'This organization has reached the project limit for its plan',
      );
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('projects')
@UseGuards(OrgScopeGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext): Promise<ProjectListView[]> {
    return this.projects.list(org);
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<ProjectView> {
    return unwrap(await this.projects.findOne(org, id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<ProjectView> {
    return unwrap(await this.projects.create(org, body));
  }

  @Patch(':id')
  async update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<ProjectView> {
    return unwrap(await this.projects.update(org, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<void> {
    unwrap(await this.projects.remove(org, id));
  }
}

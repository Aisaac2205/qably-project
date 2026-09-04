import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  RepositoryError,
  RepositoryView,
  RotatedWebhookSecret,
} from './repository.contracts';
import { RepositoryService } from './repository.service';

function unwrap<T>(result: Result<T, RepositoryError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Project not found');
    case 'no-connection':
      throw new NotFoundException('This project has no repository connected');
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('projects/:projectId/repository')
@UseGuards(OrgScopeGuard)
export class RepositoryController {
  constructor(private readonly repository: RepositoryService) {}

  @Get()
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ): Promise<RepositoryView> {
    return unwrap(await this.repository.findOne(org, projectId));
  }

  @Post('webhook-secret')
  @HttpCode(HttpStatus.CREATED)
  async rotateWebhookSecret(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ): Promise<RotatedWebhookSecret> {
    return unwrap(await this.repository.rotateWebhookSecret(org, projectId));
  }
}

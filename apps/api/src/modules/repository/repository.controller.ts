import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { RepositoryError, RepositoryView } from './repository.contracts';
import { RepositoryService } from './repository.service';

function unwrap<T>(result: Result<T, RepositoryError>): T {
  if (!isErr(result)) return result.value;

  throw new NotFoundException('Project not found');
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
}

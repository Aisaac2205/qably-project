import {
  Body,
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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ApiKeyError,
  ApiKeyView,
  ApiKeyWithSecretView,
} from './api-keys.contracts';
import { createApiKeySchema, type CreateApiKeyInput } from './api-keys.schemas';
import { ApiKeysService } from './api-keys.service';

function unwrap<T>(result: Result<T, ApiKeyError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Api key not found');
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('projects/:projectId/api-keys')
@UseGuards(OrgScopeGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ): Promise<ApiKeyView[]> {
    return unwrap(await this.apiKeys.list(org, projectId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
  ): Promise<ApiKeyWithSecretView> {
    return unwrap(await this.apiKeys.create(org, projectId, body));
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<ApiKeyView> {
    return unwrap(await this.apiKeys.revoke(org, projectId, id));
  }
}

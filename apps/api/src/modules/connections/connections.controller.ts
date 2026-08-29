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
  ConnectionError,
  ConnectionView,
  ConnectionWithSecretView,
  WebhookSecretResult,
} from './connections.contracts';
import {
  createConnectionSchema,
  updateConnectionSchema,
  type CreateConnectionInput,
  type UpdateConnectionInput,
} from './connections.schemas';
import { ConnectionsService } from './connections.service';

function unwrap<T>(result: Result<T, ConnectionError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Connection not found');
    case 'duplicate':
      throw new ConflictException(
        'A connection for that repository already exists in this organization',
      );
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('connections')
@UseGuards(OrgScopeGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext): Promise<ConnectionView[]> {
    return this.connections.list(org);
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<ConnectionView> {
    return unwrap(await this.connections.findOne(org, id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(createConnectionSchema))
    body: CreateConnectionInput,
  ): Promise<ConnectionWithSecretView> {
    return unwrap(await this.connections.create(org, body));
  }

  @Post(':id/webhook-secret')
  @HttpCode(HttpStatus.CREATED)
  async rotateWebhookSecret(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<WebhookSecretResult> {
    return unwrap(await this.connections.rotateWebhookSecret(org, id));
  }

  @Patch(':id')
  async update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConnectionSchema))
    body: UpdateConnectionInput,
  ): Promise<ConnectionView> {
    return unwrap(await this.connections.update(org, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<void> {
    unwrap(await this.connections.remove(org, id));
  }
}

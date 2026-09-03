import {
  Body,
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
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../../common/result';
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../../organizations/guards/org-scope.guard';
import type { OrgContext } from '../../organizations/organizations.contracts';
import type {
  NotificationWebhookError,
  NotificationWebhookView,
} from './webhooks.contracts';
import {
  createNotificationWebhookSchema,
  updateNotificationWebhookSchema,
  type CreateNotificationWebhookInput,
  type UpdateNotificationWebhookInput,
} from './webhooks.schemas';
import { NotificationWebhooksService } from './webhooks.service';

function unwrap<T>(result: Result<T, NotificationWebhookError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Notification webhook not found');
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('notification-webhooks')
@UseGuards(OrgScopeGuard)
export class NotificationWebhooksController {
  constructor(private readonly webhooks: NotificationWebhooksService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext): Promise<NotificationWebhookView[]> {
    return this.webhooks.list(org);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(createNotificationWebhookSchema))
    body: CreateNotificationWebhookInput,
  ): Promise<NotificationWebhookView> {
    return unwrap(await this.webhooks.create(org, body));
  }

  @Patch(':id')
  async update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateNotificationWebhookSchema))
    body: UpdateNotificationWebhookInput,
  ): Promise<NotificationWebhookView> {
    return unwrap(await this.webhooks.update(org, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<void> {
    unwrap(await this.webhooks.remove(org, id));
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  async test(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<void> {
    unwrap(await this.webhooks.test(org, id));
  }
}

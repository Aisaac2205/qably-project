import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type {
  NotificationError,
  NotificationPreferenceView,
  NotificationView,
} from './notifications.contracts';
import {
  updatePreferencesSchema,
  type UpdatePreferencesInput,
} from './notifications.schemas';
import { NotificationsService } from './notifications.service';

function unwrap<T>(result: Result<T, NotificationError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Notification not found');
    case 'forbidden':
      throw new ForbiddenException('Your role cannot perform this action');
  }
}

@Controller('notifications')
@UseGuards(OrgScopeGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationView[]> {
    return this.notifications.list(org, user.id);
  }

  @Get('preferences')
  getPreferences(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationPreferenceView[]> {
    return this.notifications.getPreferences(org, user.id);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePreferencesSchema))
    body: UpdatePreferencesInput,
  ): Promise<NotificationPreferenceView[]> {
    return this.notifications.updatePreferences(org, user.id, body);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationView> {
    return unwrap(await this.notifications.markRead(org, user.id, id));
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.notifications.markAllRead(org, user.id);
  }
}

import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  NotificationError,
  NotificationPreferenceView,
  NotificationView,
} from './notifications.contracts';
import type { UpdatePreferencesInput } from './notifications.schemas';

interface NotificationRow {
  id: string;
  organizationId: string;
  userId: string;
  eventType: NotificationView['eventType'];
  severity: NotificationView['severity'];
  payload: unknown;
  projectId: string | null;
  runId: string | null;
  testCaseId: string | null;
  ingestionBatchId: string | null;
  connectionId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

function toView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    eventType: row.eventType,
    severity: row.severity,
    payload: row.payload as Record<string, string | number>,
    ...(row.projectId === null ? {} : { projectId: row.projectId }),
    ...(row.runId === null ? {} : { runId: row.runId }),
    ...(row.testCaseId === null ? {} : { testCaseId: row.testCaseId }),
    ...(row.ingestionBatchId === null
      ? {}
      : { ingestionBatchId: row.ingestionBatchId }),
    ...(row.connectionId === null ? {} : { connectionId: row.connectionId }),
    createdAt: row.createdAt.toISOString(),
    ...(row.readAt === null ? {} : { readAt: row.readAt.toISOString() }),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(org: OrgContext, userId: string): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: { organizationId: org.organizationId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return (rows as NotificationRow[]).map(toView);
  }

  async markRead(
    org: OrgContext,
    userId: string,
    id: string,
  ): Promise<Result<NotificationView, NotificationError>> {
    const existing = await this.scoped(org, userId, id);

    if (existing === null) return err('not-found');

    const row = await this.prisma.notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
    });

    return ok(toView(row as NotificationRow));
  }

  async markAllRead(org: OrgContext, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { organizationId: org.organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  getPreferences(
    org: OrgContext,
    userId: string,
  ): Promise<NotificationPreferenceView[]> {
    return this.prisma.notificationPreference.findMany({
      where: { organizationId: org.organizationId, userId },
    });
  }

  async updatePreferences(
    org: OrgContext,
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<NotificationPreferenceView[]> {
    if (input.locale !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { locale: input.locale },
      });
    }

    await Promise.all(
      input.preferences.map((preference) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_organizationId_eventType_channel: {
              userId,
              organizationId: org.organizationId,
              eventType: preference.eventType,
              channel: preference.channel,
            },
          },
          create: {
            userId,
            organizationId: org.organizationId,
            eventType: preference.eventType,
            channel: preference.channel,
            enabled: preference.enabled,
          },
          update: { enabled: preference.enabled },
        }),
      ),
    );

    return this.getPreferences(org, userId);
  }

  private scoped(
    org: OrgContext,
    userId: string,
    id: string,
  ): Promise<NotificationRow | null> {
    return this.prisma.notification.findFirst({
      where: { id, organizationId: org.organizationId, userId },
    });
  }
}

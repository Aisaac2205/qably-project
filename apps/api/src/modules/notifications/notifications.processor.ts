import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Locale } from '@qably/i18n';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationChannel,
} from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { notificationDigestEmail } from '../mailer/templates/notification-digest';
import type { NotificationJobData } from './notifications.contracts';
import { NOTIFICATIONS_QUEUE } from './notifications.contracts';
import { renderNotificationMessage } from './lib/render-notification-message';

interface RecipientRow {
  userId: string;
  user: { locale: string; email: string; name: string };
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const event = job.data;
    const recipients = await this.resolveRecipients(event);

    for (const recipient of recipients) {
      await this.notify(event, recipient);
    }
  }

  private resolveRecipients(
    event: NotificationJobData,
  ): Promise<RecipientRow[]> {
    return this.prisma.orgMember.findMany({
      where: {
        organizationId: event.organizationId,
        ...(event.eventType === 'connection_security'
          ? { role: { in: ['owner', 'admin'] } }
          : {}),
      },
      select: {
        userId: true,
        user: { select: { locale: true, email: true, name: true } },
      },
    });
  }

  private async notify(
    event: NotificationJobData,
    recipient: RecipientRow,
  ): Promise<void> {
    const inAppEnabled = await this.isEnabled(
      event,
      recipient.userId,
      'in_app',
    );
    const emailEnabled = await this.isEnabled(event, recipient.userId, 'email');

    if (inAppEnabled) {
      await this.prisma.notification.upsert({
        where: {
          userId_dedupeKey: {
            userId: recipient.userId,
            dedupeKey: event.dedupeKey,
          },
        },
        create: {
          userId: recipient.userId,
          organizationId: event.organizationId,
          eventType: event.eventType,
          severity: event.severity,
          payload: event.payload,
          dedupeKey: event.dedupeKey,
          ...(event.projectId === undefined
            ? {}
            : { projectId: event.projectId }),
          ...(event.runId === undefined ? {} : { runId: event.runId }),
          ...(event.testCaseId === undefined
            ? {}
            : { testCaseId: event.testCaseId }),
          ...(event.ingestionBatchId === undefined
            ? {}
            : { ingestionBatchId: event.ingestionBatchId }),
          ...(event.connectionId === undefined
            ? {}
            : { connectionId: event.connectionId }),
        },
        update: {},
      });
    }

    if (emailEnabled) {
      const locale = recipient.user.locale as Locale;
      const message = renderNotificationMessage(
        locale,
        event.eventType,
        event.payload,
      );
      const { subject, html } = notificationDigestEmail({ message });

      await this.mailer.send({ to: recipient.user.email, subject, html });
    }
  }

  private async isEnabled(
    event: NotificationJobData,
    userId: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_organizationId_eventType_channel: {
          userId,
          organizationId: event.organizationId,
          eventType: event.eventType,
          channel,
        },
      },
    });

    return (
      (row as { enabled: boolean } | null)?.enabled ??
      DEFAULT_NOTIFICATION_PREFERENCES[event.eventType][channel]
    );
  }
}

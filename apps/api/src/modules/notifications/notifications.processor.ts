import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationWebhookType,
} from '@qably/types';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { notificationDigestEmail } from '../mailer/templates/notification-digest';
import type {
  WebhookChannel,
  WebhookNotification,
} from './webhooks/channels/channel.contracts';
import { DiscordChannel } from './webhooks/channels/discord.channel';
import { SlackChannel } from './webhooks/channels/slack.channel';
import type { NotificationJobData } from './notifications.contracts';
import { NOTIFICATIONS_QUEUE } from './notifications.contracts';
import {
  renderNotificationMessage,
  renderNotificationSubject,
} from './lib/render-notification-message';
import { notificationColor } from './lib/notification-appearance';

interface RecipientRow {
  userId: string;
  user: { locale: string | null; email: string; name: string };
}

interface NotificationWebhookRow {
  id: string;
  encryptedUrl: string;
  type: NotificationWebhookType;
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly encryption: EncryptionService,
    private readonly slack: SlackChannel,
    private readonly discord: DiscordChannel,
    @InjectEnv() private readonly env: Env,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const event = job.data;
    const recipients = await this.resolveRecipients(event);

    for (const recipient of recipients) {
      await this.notify(event, recipient);
    }

    await this.notifyWebhooks(event);
  }

  private async notifyWebhooks(event: NotificationJobData): Promise<void> {
    const webhooks = await this.prisma.notificationWebhook.findMany({
      where: {
        organizationId: event.organizationId,
        enabled: true,
        eventTypes: { has: event.eventType },
      },
      select: { id: true, encryptedUrl: true, type: true },
    });

    if (webhooks.length === 0) return;

    const locale = await resolveOrgDefaultLocale(
      this.prisma,
      event.organizationId,
    );
    const deepLinkUrl = this.deepLink(event);
    const notification: WebhookNotification = {
      title: renderNotificationSubject(locale, event.eventType, event.payload),
      message: renderNotificationMessage(
        locale,
        event.eventType,
        event.payload,
      ),
      color: notificationColor(event.eventType),
      timestamp: new Date().toISOString(),
      ...(deepLinkUrl === undefined ? {} : { url: deepLinkUrl }),
    };

    for (const webhook of webhooks as NotificationWebhookRow[]) {
      const existing = await this.prisma.notificationDelivery.findUnique({
        where: {
          webhookId_dedupeKey: {
            webhookId: webhook.id,
            dedupeKey: event.dedupeKey,
          },
        },
        select: { status: true },
      });

      if (existing?.status === 'sent') continue;

      const url = this.encryption.decrypt(webhook.encryptedUrl);
      let status: NotificationDeliveryStatus = 'sent';
      let errorMessage: string | undefined;

      try {
        await this.resolveWebhookChannel(webhook.type).send(url, notification);
      } catch (error) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to deliver ${webhook.type} notification for organization ${event.organizationId}: ${errorMessage}`,
        );
      }

      await this.prisma.notificationDelivery.upsert({
        where: {
          webhookId_dedupeKey: {
            webhookId: webhook.id,
            dedupeKey: event.dedupeKey,
          },
        },
        create: {
          organizationId: event.organizationId,
          eventType: event.eventType,
          dedupeKey: event.dedupeKey,
          channel: webhook.type,
          webhookId: webhook.id,
          status,
          ...(errorMessage === undefined ? {} : { errorMessage }),
        },
        update: {
          status,
          deliveredAt: new Date(),
          errorMessage: errorMessage ?? null,
        },
      });
    }
  }

  private deepLink(event: NotificationJobData): string | undefined {
    if (event.projectId === undefined || event.runId === undefined) {
      return undefined;
    }

    return new URL(
      `/projects/${event.projectId}/runs/${event.runId}`,
      this.env.WEB_APP_URL,
    ).toString();
  }

  private resolveWebhookChannel(type: NotificationWebhookType): WebhookChannel {
    return type === 'slack' ? this.slack : this.discord;
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
          userId_organizationId_dedupeKey: {
            userId: recipient.userId,
            organizationId: event.organizationId,
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
      const locale = resolveLocale(recipient.user.locale);
      const message = renderNotificationMessage(
        locale,
        event.eventType,
        event.payload,
      );
      const subject = renderNotificationSubject(
        locale,
        event.eventType,
        event.payload,
      );
      const preferencesUrl = new URL(
        '/settings',
        this.env.WEB_APP_URL,
      ).toString();
      const { html } = notificationDigestEmail({
        locale,
        subject,
        message,
        preferencesUrl,
      });

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

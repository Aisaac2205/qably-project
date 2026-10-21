import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationEventType,
  type NotificationWebhookType,
} from '@qably/types';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { OnDemandProcessor } from '../../common/queue/on-demand-processor.decorator';
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

/**
 * Events whose dedupeKey names something that keeps growing, so a repeat is
 * news: it rewrites the payload of the existing notification instead of being
 * dropped. The row stays where it is, and a read notification stays read.
 */
const REFRESHED_ON_REPEAT: ReadonlySet<NotificationEventType> = new Set([
  'proposals_ready',
]);

@OnDemandProcessor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly encryption: EncryptionService,
    private readonly slack: SlackChannel,
    private readonly discord: DiscordChannel,
    @InjectEnv() private readonly env: Env,
  ) {}

  async process(job: Job<NotificationJobData>): Promise<void> {
    const event = await this.withCurrentProposalCount(job.data);
    if (event === null) return;

    const recipients = await this.resolveRecipients(event);

    for (const recipient of recipients) {
      await this.notify(event, recipient);
    }

    await this.notifyWebhooks(event);
  }

  /**
   * A push with several test files runs one extraction job per file, and each
   * announces the same batch. What a job carries is only its own share, so the
   * number is read again here, from the proposals that wait in the batch right
   * now. A retried job reads the same number, and the last job to run settles
   * on the full one. A batch with nothing left to review is not announced.
   *
   * Only a push has an ingestion batch to recount. Every other source announces
   * a single proposal and keeps the count it carried.
   */
  private async withCurrentProposalCount(
    event: NotificationJobData,
  ): Promise<NotificationJobData | null> {
    if (
      event.eventType !== 'proposals_ready' ||
      event.ingestionBatchId === undefined
    ) {
      return event;
    }

    const count = await this.prisma.extractedProposal.count({
      where: {
        status: 'in_review',
        project: { organizationId: event.organizationId },
        codeChange: { batchId: event.ingestionBatchId },
      },
    });

    if (count === 0) return null;

    return { ...event, payload: { ...event.payload, count } };
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
    if (event.eventType === 'proposals_ready') {
      return this.reviewInboxLink(event);
    }

    if (event.eventType === 'extraction_capped') {
      return this.repositoryLink(event);
    }

    if (event.projectId === undefined || event.runId === undefined) {
      return undefined;
    }

    return new URL(
      `/projects/${event.projectId}/runs/${event.runId}`,
      this.env.WEB_APP_URL,
    ).toString();
  }

  private repositoryLink(event: NotificationJobData): string | undefined {
    if (event.projectId === undefined) return undefined;

    return new URL(
      `/projects/${encodeURIComponent(event.projectId)}/repository`,
      this.env.WEB_APP_URL,
    ).toString();
  }

  private reviewInboxLink(event: NotificationJobData): string | undefined {
    const batchId = event.payload.batchId;

    if (event.projectId === undefined || batchId === undefined) {
      return undefined;
    }

    const url = new URL('/review-inbox', this.env.WEB_APP_URL);
    url.searchParams.set('projectId', event.projectId);
    url.searchParams.set('batch', String(batchId));

    return url.toString();
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
        update: REFRESHED_ON_REPEAT.has(event.eventType)
          ? { payload: event.payload }
          : {},
      });
    }

    if (emailEnabled && !(await this.wasEmailSent(event, recipient.userId))) {
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

      try {
        await this.mailer.send({ to: recipient.user.email, subject, html });
      } catch (error) {
        await this.recordEmailDelivery(
          event,
          recipient.userId,
          'failed',
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }

      await this.recordEmailDelivery(event, recipient.userId, 'sent');
    }
  }

  /**
   * Only a confirmed send counts, as with webhooks: a failed delivery is retried.
   * Without this, every job that shares a dedupeKey would email the recipient again.
   */
  private async wasEmailSent(
    event: NotificationJobData,
    userId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.notificationDelivery.findUnique({
      where: {
        userId_dedupeKey_channel: {
          userId,
          dedupeKey: event.dedupeKey,
          channel: 'email',
        },
      },
      select: { status: true },
    });

    return existing?.status === 'sent';
  }

  private async recordEmailDelivery(
    event: NotificationJobData,
    userId: string,
    status: NotificationDeliveryStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.notificationDelivery.upsert({
      where: {
        userId_dedupeKey_channel: {
          userId,
          dedupeKey: event.dedupeKey,
          channel: 'email',
        },
      },
      create: {
        organizationId: event.organizationId,
        eventType: event.eventType,
        dedupeKey: event.dedupeKey,
        channel: 'email',
        userId,
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

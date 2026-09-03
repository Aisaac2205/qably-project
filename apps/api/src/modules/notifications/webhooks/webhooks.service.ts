import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { err, ok, type Result } from '../../../common/result';
import type { OrgContext } from '../../organizations/organizations.contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import { DiscordChannel } from './channels/discord.channel';
import { SlackChannel } from './channels/slack.channel';
import type { WebhookChannel } from './channels/channel.contracts';
import { maskWebhookUrl } from './lib/mask-webhook-url';
import type {
  NotificationWebhookError,
  NotificationWebhookRow,
  NotificationWebhookView,
} from './webhooks.contracts';
import type {
  CreateNotificationWebhookInput,
  UpdateNotificationWebhookInput,
} from './webhooks.schemas';

export const WEBHOOK_TEST_MESSAGE =
  'Qably test notification — if you can see this, the webhook is configured correctly.';

function canWrite(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

@Injectable()
export class NotificationWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly slack: SlackChannel,
    private readonly discord: DiscordChannel,
  ) {}

  async list(org: OrgContext): Promise<NotificationWebhookView[]> {
    const rows = await this.prisma.notificationWebhook.findMany({
      where: { organizationId: org.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return (rows as NotificationWebhookRow[]).map((row) => this.toView(row));
  }

  async create(
    org: OrgContext,
    input: CreateNotificationWebhookInput,
  ): Promise<Result<NotificationWebhookView, NotificationWebhookError>> {
    if (!canWrite(org)) return err('forbidden');

    const row = await this.prisma.notificationWebhook.create({
      data: {
        organizationId: org.organizationId,
        type: input.type,
        name: input.name,
        encryptedUrl: this.encryption.encrypt(input.url),
        eventTypes: input.eventTypes,
      },
    });

    return ok(this.toView(row as NotificationWebhookRow));
  }

  async update(
    org: OrgContext,
    id: string,
    input: UpdateNotificationWebhookInput,
  ): Promise<Result<NotificationWebhookView, NotificationWebhookError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    const row = await this.prisma.notificationWebhook.update({
      where: { id },
      data: input,
    });

    return ok(this.toView(row as NotificationWebhookRow));
  }

  async remove(
    org: OrgContext,
    id: string,
  ): Promise<Result<void, NotificationWebhookError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    await this.prisma.notificationWebhook.delete({ where: { id } });

    return ok(undefined);
  }

  async test(
    org: OrgContext,
    id: string,
  ): Promise<Result<void, NotificationWebhookError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    const url = this.encryption.decrypt(existing.encryptedUrl);

    await this.resolveChannel(existing.type).send(url, WEBHOOK_TEST_MESSAGE);

    return ok(undefined);
  }

  private resolveChannel(
    type: NotificationWebhookRow['type'],
  ): WebhookChannel {
    return type === 'slack' ? this.slack : this.discord;
  }

  private toView(row: NotificationWebhookRow): NotificationWebhookView {
    return {
      id: row.id,
      organizationId: row.organizationId,
      type: row.type,
      name: row.name,
      maskedUrl: maskWebhookUrl(this.encryption.decrypt(row.encryptedUrl)),
      enabled: row.enabled,
      eventTypes: row.eventTypes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private scoped(
    org: OrgContext,
    id: string,
  ): Promise<NotificationWebhookRow | null> {
    return this.prisma.notificationWebhook.findFirst({
      where: { id, organizationId: org.organizationId },
    }) as Promise<NotificationWebhookRow | null>;
  }
}

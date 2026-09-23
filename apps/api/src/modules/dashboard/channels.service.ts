import { Injectable } from '@nestjs/common';
import type { DashboardChannelsRecord } from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import { fixedCalendarWindow } from '../../common/metrics/calendar-window';
import {
  CHANNELS_WINDOW_DAYS,
  buildDashboardChannels,
  type DeliveryCountRow,
  type LastDeliveryRow,
} from '../../common/metrics/delivery-activity';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { DashboardError } from './dashboard.contracts';
import { isUnknownTimeZoneError } from './lib/time-zone-error';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async channels(
    org: OrgContext,
    userId: string,
    zone: string,
  ): Promise<Result<DashboardChannelsRecord, DashboardError>> {
    const organizationId = org.organizationId;
    const now = new Date();
    const window = fixedCalendarWindow(CHANNELS_WINDOW_DAYS, zone, now);

    try {
      const [webhooks, emailPreferenceRows] = await Promise.all([
        this.prisma.notificationWebhook.findMany({
          where: { organizationId, enabled: true },
          select: { id: true, type: true, name: true, eventTypes: true },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.notificationPreference.findMany({
          where: { organizationId, userId, channel: 'email' },
          select: { eventType: true, enabled: true },
        }),
      ]);

      const webhookIds = webhooks.map((webhook) => webhook.id);

      const [deliveryCountRows, lastDelivery] = await Promise.all([
        webhookIds.length === 0
          ? Promise.resolve<DeliveryCountRow[]>([])
          : this.prisma.$queryRaw<DeliveryCountRow[]>(Prisma.sql`
              SELECT d."webhookId" AS "webhookId",
                     to_char((d."deliveredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS day,
                     d.status AS status,
                     COUNT(*)::int AS count
                FROM "notification_delivery" d
               WHERE d."organizationId" = ${organizationId}
                 AND d."webhookId" IN (${Prisma.join(webhookIds)})
                 AND d."deliveredAt" >= ${window.start}
                 AND d."deliveredAt" < ${window.end}
               GROUP BY 1, 2, 3
            `),
        webhookIds.length === 0
          ? Promise.resolve<LastDeliveryRow | null>(null)
          : this.prisma.notificationDelivery.findFirst({
              where: { organizationId, webhookId: { in: webhookIds } },
              orderBy: [{ deliveredAt: 'desc' }, { id: 'desc' }],
              select: {
                webhookId: true,
                eventType: true,
                status: true,
                deliveredAt: true,
              },
            }),
      ]);

      const record = buildDashboardChannels({
        dayKeys: window.dayKeys,
        webhooks,
        deliveryCountRows,
        emailPreferenceRows,
        lastDelivery,
      });

      return ok(record);
    } catch (error) {
      if (isUnknownTimeZoneError(error)) return err('invalid-time-zone');
      throw error;
    }
  }
}

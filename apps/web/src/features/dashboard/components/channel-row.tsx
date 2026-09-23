'use client'

import Image from 'next/image'
import { DeliveryBars } from '@qably/ui/dashboard'
import type { DashboardWebhookChannel, NotificationWebhookType } from '@qably/types'
import { formatNumber } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

const LOGO_SRC: Record<NotificationWebhookType, string> = {
  slack: '/logos/slack.svg',
  discord: '/logos/discord.svg',
}

export interface ChannelRowProps {
  webhook: DashboardWebhookChannel
}

export function ChannelRow({ webhook }: ChannelRowProps) {
  const { t } = useTranslation()
  const eventTypesLabel = webhook.eventTypes
    .map((eventType) => t(`settings.notifications.events.${eventType}`))
    .join(', ')

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Image src={LOGO_SRC[webhook.type]} alt="" width={20} height={20} className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{webhook.name}</p>
          <p className="truncate text-xs text-muted">{eventTypesLabel}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <DeliveryBars
          points={webhook.daily}
          label={t('dashboard.channelsDeliveryLabel', { name: webhook.name })}
          sentLabel={t('dashboard.channelsSentLabel')}
          failedLabel={t('dashboard.channelsFailedLabel')}
          className="w-28"
        />
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="flex flex-col items-end" data-testid="channel-sent-count">
            <span className="font-semibold text-default">{formatNumber(webhook.sent)}</span>
            <span className="text-muted">{t('dashboard.channelsSentLabel')}</span>
          </span>
          <span className="flex flex-col items-end" data-testid="channel-failed-count">
            <span className="font-semibold text-default">{formatNumber(webhook.failed)}</span>
            <span className="text-muted">{t('dashboard.channelsFailedLabel')}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

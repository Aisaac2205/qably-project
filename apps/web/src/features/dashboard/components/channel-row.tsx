'use client'

import Image from 'next/image'
import { ChannelStat, DeliveryBars } from '@qably/ui/dashboard'
import type { DashboardWebhookChannel, NotificationWebhookType } from '@qably/types'
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

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border">
          <Image src={LOGO_SRC[webhook.type]} alt="" width={20} height={20} className="size-5 shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{webhook.name}</p>
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
        <div className="flex shrink-0 items-end gap-3">
          <ChannelStat
            value={webhook.sent}
            unit={t('dashboard.channelsSentUnit', { count: webhook.sent })}
            srText={t('dashboard.channelsSentCount', { count: webhook.sent })}
            data-testid="channel-sent-count"
          />
          <ChannelStat
            value={webhook.failed}
            unit={t('dashboard.channelsFailedUnit', { count: webhook.failed })}
            srText={t('dashboard.channelsFailedCount', { count: webhook.failed })}
            tone={webhook.failed > 0 ? 'fail' : 'pass'}
            data-testid="channel-failed-count"
          />
        </div>
      </div>
    </div>
  )
}

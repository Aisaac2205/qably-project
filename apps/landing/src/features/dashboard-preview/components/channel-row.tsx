import React from 'react'
import { SealCheck } from '@phosphor-icons/react'
import type { DashboardWebhookChannel, NotificationWebhookType } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { ChannelStat } from './channel-stat'
import { DeliveryBars } from './delivery-bars'

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
    <div className="group grid flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 transition-colors duration-150 ease-out hover:bg-canvas-hover/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <img
            src={LOGO_SRC[webhook.type]}
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 object-contain transition-transform duration-150 ease-out group-hover:scale-105"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{webhook.name}</p>
        </div>
      </div>

      <div className="contents">
        <DeliveryBars
          points={webhook.daily}
          label={t('dashboard.channelsDeliveryLabel', { name: webhook.name })}
          sentLabel={t('dashboard.channelsSentLabel')}
          failedLabel={t('dashboard.channelsFailedLabel')}
          className="shrink-0"
        />
        <div className="flex shrink-0 items-center">
          <span className="inline-flex h-8 md:h-7 items-center gap-1 pl-2.5 text-xs font-medium text-muted">
            <span>{t('dashboard.channelsStatusConnected')}</span>
            <SealCheck size={12} weight="bold" className="text-pass shrink-0" aria-hidden="true" />
          </span>
          <div className="sr-only">
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
    </div>
  )
}

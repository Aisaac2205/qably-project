import React from 'react'
import { CaretRight, SealCheck, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import type { DashboardChannelsRecord, DashboardEmailChannel, DashboardInAppChannel } from '@qably/types'
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { resolveLastDeliveryWebhookName } from '../lib/resolve-last-delivery'
import { formatRelativeTime, type FormatLocale } from '../lib/format'
import { ChannelRow } from './channel-row'
import { ChannelStat } from './channel-stat'
import { DeliveryBars } from './delivery-bars'
import { useTranslation } from '@/lib/i18n'

export interface ChannelsCardProps {
  channels: DashboardChannelsRecord
}

function InAppChannelRow({ inApp }: { inApp: DashboardInAppChannel }) {
  const { t } = useTranslation()
  const name = t('dashboard.channelsInAppName')

  return (
    <div className="group grid flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 transition-colors duration-150 ease-out hover:bg-canvas-hover/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <img
            src="/icono-qably.png"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 object-contain transition-transform duration-150 ease-out group-hover:scale-105"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{name}</p>
        </div>
      </div>

      <div className="contents">
        <DeliveryBars
          points={inApp.daily}
          label={t('dashboard.channelsDeliveryLabel', { name })}
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
              value={inApp.sent}
              unit={t('dashboard.channelsSentUnit', { count: inApp.sent })}
              srText={t('dashboard.channelsSentCount', { count: inApp.sent })}
              data-testid="in-app-sent-count"
            />
            <ChannelStat
              value={inApp.unread}
              unit={t('dashboard.channelsUnreadUnit', { count: inApp.unread })}
              srText={t('dashboard.channelsUnreadCount', { count: inApp.unread })}
              tone="default"
              data-testid="in-app-unread-count"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmailChannelRow({ email }: { email: DashboardEmailChannel }) {
  const { t } = useTranslation()
  const name = t('dashboard.channelsEmailName')

  return (
    <div className="group grid flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 transition-colors duration-150 ease-out hover:bg-canvas-hover/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <img
            src="/logos/gmail.svg"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 object-contain transition-transform duration-150 ease-out group-hover:scale-105"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{name}</p>
        </div>
      </div>

      <div className="contents">
        <DeliveryBars
          points={email.daily}
          label={t('dashboard.channelsDeliveryLabel', { name })}
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
              value={email.sent}
              unit={t('dashboard.channelsSentUnit', { count: email.sent })}
              srText={t('dashboard.channelsSentCount', { count: email.sent })}
              data-testid="channel-sent-count"
            />
            <ChannelStat
              value={email.failed}
              unit={t('dashboard.channelsFailedUnit', { count: email.failed })}
              srText={t('dashboard.channelsFailedCount', { count: email.failed })}
              tone={email.failed > 0 ? 'fail' : 'pass'}
              data-testid="channel-failed-count"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChannelsCard({ channels }: ChannelsCardProps) {
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const title = t('dashboard.channelsTitle')
  const lastDelivery = channels.lastDelivery

  const lastDeliveryChannelName =
    lastDelivery === null
      ? ''
      : lastDelivery.channel === 'in_app'
        ? t('dashboard.channelsInAppName')
        : lastDelivery.channel === 'email'
          ? t('dashboard.channelsEmailName')
          : resolveLastDeliveryWebhookName(channels) ??
            t('dashboard.channelsFallbackWebhookName')

  const lastDeliveryText =
    lastDelivery === null
      ? t('dashboard.channelsNoDeliveries')
      : lastDelivery.status === 'sent'
        ? t('dashboard.channelsLastDeliverySent', {
            channel: lastDeliveryChannelName,
            time: formatRelativeTime(lastDelivery.deliveredAt, timeLocale),
          })
        : t('dashboard.channelsLastDeliveryFailed', {
            channel: lastDeliveryChannelName,
            time: formatRelativeTime(lastDelivery.deliveredAt, timeLocale),
          })

  return (
    <Card as="section" aria-labelledby="channels-card-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h2" id="channels-card-heading">
          {title}
        </CardTitle>
      </CardHeader>

      <div className="flex flex-1 flex-col divide-y divide-border">
        <InAppChannelRow inApp={channels.inApp} />
        {channels.webhooks.map((webhook) => (
          <ChannelRow key={webhook.id} webhook={webhook} />
        ))}
        {channels.email.enabled && <EmailChannelRow email={channels.email} />}
      </div>

      <CardFooter className="flex items-center gap-2 border-t border-border bg-canvas/30 px-5 py-3 text-xs text-muted">
        {lastDelivery?.status === 'failed' ? (
          <WarningCircle size={14} weight="bold" className="shrink-0 text-fail" aria-hidden="true" />
        ) : (
          <PaperPlaneTilt size={14} weight="bold" className="shrink-0 text-muted" aria-hidden="true" />
        )}
        <span className="truncate">{lastDeliveryText}</span>
      </CardFooter>
    </Card>
  )
}

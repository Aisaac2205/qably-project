'use client'

import Image from 'next/image'
import { ChannelStat, DeliveryBars } from '@qably/ui/dashboard'
import type { DashboardEmailChannel, DashboardInAppChannel } from '@qably/types'
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardChannels } from '@/features/dashboard/hooks/use-dashboard-channels'
import { resolveLastDeliveryWebhookName } from '@/features/dashboard/lib/resolve-last-delivery'
import { formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
import { ChannelRow } from '@/features/dashboard/components/channel-row'
import { useTranslation } from '@/lib/i18n'

const SKELETON_ROWS = 3

function ChannelsCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-5 pb-5">
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

function InAppChannelRow({ inApp }: { inApp: DashboardInAppChannel }) {
  const { t } = useTranslation()
  const name = t('dashboard.channelsInAppName')

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border">
          <Image src="/icono-qably.png" alt="" width={20} height={20} className="size-5 shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{name}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <DeliveryBars
          points={inApp.daily}
          label={t('dashboard.channelsDeliveryLabel', { name })}
          sentLabel={t('dashboard.channelsSentLabel')}
          failedLabel={t('dashboard.channelsFailedLabel')}
          className="w-28"
        />
        <div className="flex shrink-0 items-end gap-3">
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
            tone="muted"
            data-testid="in-app-unread-count"
          />
        </div>
      </div>
    </div>
  )
}

function EmailChannelRow({ email }: { email: DashboardEmailChannel }) {
  const { t } = useTranslation()
  const name = t('dashboard.channelsEmailName')

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border">
          <Image src="/logos/gmail.svg" alt="" width={20} height={20} className="size-5 shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{name}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <DeliveryBars
          points={email.daily}
          label={t('dashboard.channelsDeliveryLabel', { name })}
          sentLabel={t('dashboard.channelsSentLabel')}
          failedLabel={t('dashboard.channelsFailedLabel')}
          className="w-28"
        />
        <div className="flex shrink-0 items-end gap-3">
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
  )
}

export function ChannelsCard() {
  const { channels, isLoading, isError, retry } = useDashboardChannels()
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const title = t('dashboard.channelsTitle')

  const isEmpty =
    channels !== undefined &&
    channels.webhooks.length === 0 &&
    !channels.email.enabled &&
    channels.inApp.sent === 0

  return (
    <Card as="section" aria-labelledby="channels-card-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h2" id="channels-card-heading">
          {title}
        </CardTitle>
      </CardHeader>

      {isError ? (
        <StateView
          kind="error"
          title={t('dashboard.loadErrorTitle')}
          description={t('dashboard.loadErrorDescription')}
          action={
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : isLoading || channels === undefined ? (
        <ChannelsCardSkeleton />
      ) : isEmpty ? (
        <StateView kind="empty" title={t('dashboard.channelsEmptyTitle')} />
      ) : (
        <>
          <div className="flex flex-grow flex-col divide-y divide-border">
            <InAppChannelRow inApp={channels.inApp} />
            {channels.webhooks.map((webhook) => (
              <ChannelRow key={webhook.id} webhook={webhook} />
            ))}
            {channels.email.enabled ? <EmailChannelRow email={channels.email} /> : null}
          </div>

          {channels.lastDelivery !== null ? (
            <CardFooter className="mt-auto pt-3">
              <span className="text-xs text-muted">
                {t('dashboard.channelsLastDelivery', {
                  status: t(
                    channels.lastDelivery.status === 'sent'
                      ? 'dashboard.channelsDeliveryStatusSent'
                      : 'dashboard.channelsDeliveryStatusFailed',
                  ),
                  name:
                    channels.lastDelivery.channel === 'email'
                      ? t('dashboard.channelsEmailName')
                      : (resolveLastDeliveryWebhookName(channels) ??
                        channels.lastDelivery.webhookId ??
                        ''),
                  time: formatRelativeTime(channels.lastDelivery.deliveredAt, timeLocale),
                })}
              </span>
            </CardFooter>
          ) : null}
        </>
      )}
    </Card>
  )
}

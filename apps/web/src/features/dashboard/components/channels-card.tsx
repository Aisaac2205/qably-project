'use client'

import Image from 'next/image'
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

export function ChannelsCard() {
  const { channels, isLoading, isError, retry } = useDashboardChannels()
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const title = t('dashboard.channelsTitle')

  const isEmpty =
    channels !== undefined && channels.webhooks.length === 0 && !channels.email.enabled

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
          <div className="flex flex-col divide-y divide-border">
            {channels.webhooks.map((webhook) => (
              <ChannelRow key={webhook.id} webhook={webhook} />
            ))}
            {channels.email.enabled ? (
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Image src="/logos/gmail.svg" alt="" width={20} height={20} className="size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-default">{t('dashboard.channelsEmailName')}</p>
                  <p className="truncate text-xs text-muted">
                    {channels.email.eventTypes
                      .map((eventType) => t(`settings.notifications.events.${eventType}`))
                      .join(', ')}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {channels.lastDelivery !== null ? (
            <CardFooter className="pt-3">
              <span className="text-xs text-muted">
                {t('dashboard.channelsLastDelivery', {
                  status: t(
                    channels.lastDelivery.status === 'sent'
                      ? 'dashboard.channelsDeliveryStatusSent'
                      : 'dashboard.channelsDeliveryStatusFailed',
                  ),
                  name:
                    resolveLastDeliveryWebhookName(channels) ?? channels.lastDelivery.webhookId,
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

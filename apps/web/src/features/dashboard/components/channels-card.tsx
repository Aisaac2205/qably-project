'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CaretRight, SealCheck, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react'
import { ChannelStat, DeliveryBars } from '@qably/ui/dashboard'
import type { DashboardEmailChannel, DashboardInAppChannel } from '@qably/types'
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDashboardChannels } from '@/features/dashboard/hooks/use-dashboard-channels'
import { resolveLastDeliveryWebhookName } from '@/features/dashboard/lib/resolve-last-delivery'
import { formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
import { ChannelRow } from '@/features/dashboard/components/channel-row'
import { useTranslation } from '@/lib/i18n'

const SKELETON_ROWS = 3

function ChannelsCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-5">
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
    <div className="group grid flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 transition-colors duration-150 ease-out hover:bg-canvas-hover/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <Image
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
            <SealCheck size={12} weight="bold" className="text-status-pass shrink-0" aria-hidden="true" />
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
              tone="muted"
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
          <Image
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
            <SealCheck size={12} weight="bold" className="text-status-pass shrink-0" aria-hidden="true" />
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

interface UnconfiguredChannelRowProps {
  type: 'slack' | 'discord'
}

function UnconfiguredChannelRow({ type }: UnconfiguredChannelRowProps) {
  const { t } = useTranslation()
  const name = type === 'slack' ? t('dashboard.channelsSlackName') : t('dashboard.channelsDiscordName')
  const logo = type === 'slack' ? '/logos/slack.svg' : '/logos/discord.svg'

  return (
    <div className="group grid flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 transition-colors duration-150 ease-out hover:bg-canvas-hover/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center opacity-85 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:scale-105">
          <Image src={logo} alt="" width={24} height={24} className="size-6 shrink-0 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-default">{name}</p>
        </div>
      </div>

      <div className="col-start-3 flex items-center justify-end">
        <Link
          href="/settings?tab=integrations"
          aria-label={t('dashboard.channelsConnectAria', { name })}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'xs' }),
            'gap-1 rounded-md border-border/80 hover:bg-primary hover:text-primary-fg hover:border-primary active:scale-[0.97] transition-all duration-150',
          )}
        >
          <span>{t('dashboard.channelsConnect')}</span>
          <CaretRight size={12} weight="bold" aria-hidden="true" />
        </Link>
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

  const discordWebhooks = channels?.webhooks.filter((w) => w.type === 'discord') ?? []
  const slackWebhooks = channels?.webhooks.filter((w) => w.type === 'slack') ?? []
  const otherWebhooks = channels?.webhooks.filter((w) => w.type !== 'discord' && w.type !== 'slack') ?? []

  return (
    <Card as="section" aria-labelledby="channels-card-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 px-5 py-3.5 pb-3.5 bg-canvas/30">
        <div className="flex items-center gap-2.5">
          <CardTitle as="h2" id="channels-card-heading" className="text-sm font-semibold tracking-tight text-default">
            {title}
          </CardTitle>
          {channels && (
            <span className="inline-flex items-center justify-center rounded-full bg-surface px-2 py-0.5 text-[11px] font-mono font-medium text-muted border border-border/50">
              {(channels.inApp.sent > 0 ? 1 : 0) +
                channels.webhooks.length +
                (channels.email.enabled ? 1 : 0)}
            </span>
          )}
        </div>
        <Link
          href="/settings?tab=integrations"
          className="group inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-default transition-colors duration-150 rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span>{t('settings.tabs.integrations')}</span>
          <CaretRight size={12} weight="bold" className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
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
          <div className="flex flex-grow flex-col divide-y divide-border/60">
            <InAppChannelRow inApp={channels.inApp} />
            {channels.email.enabled ? <EmailChannelRow email={channels.email} /> : null}
            {discordWebhooks.map((webhook) => (
              <ChannelRow key={webhook.id} webhook={webhook} />
            ))}
            {discordWebhooks.length === 0 ? <UnconfiguredChannelRow type="discord" /> : null}
            {slackWebhooks.map((webhook) => (
              <ChannelRow key={webhook.id} webhook={webhook} />
            ))}
            {slackWebhooks.length === 0 ? <UnconfiguredChannelRow type="slack" /> : null}
            {otherWebhooks.map((webhook) => (
              <ChannelRow key={webhook.id} webhook={webhook} />
            ))}
          </div>

          {channels.lastDelivery !== null ? (
            <CardFooter className="mt-auto flex items-center gap-1.5 border-t border-border/40 pt-3">
              {channels.lastDelivery.status === 'failed' ? (
                <WarningCircle size={13} weight="bold" className="text-status-fail shrink-0" aria-hidden="true" />
              ) : (
                <PaperPlaneTilt size={13} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              )}
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

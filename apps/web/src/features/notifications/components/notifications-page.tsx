'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Bell,
  WarningOctagon,
  Warning,
  Info,
  CheckCircle,
  ArrowSquareOut,
  EnvelopeSimple,
  ChatCircleDots,
  DeviceMobile,
  Check,
} from '@phosphor-icons/react'
import type { Notification, NotificationSeverity, NotificationChannel } from '@qably/types'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { useProjects } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'

const SEVERITY_CONFIG: Record<
  NotificationSeverity,
  {
    Icon: typeof WarningOctagon
    labelKey: string
    colorClass: string
    badgeClass: string
  }
> = {
  critical: {
    Icon: WarningOctagon,
    labelKey: 'notifications.severityCritical',
    colorClass: 'text-fail',
    badgeClass: 'bg-fail-bg text-fail border-fail-border',
  },
  high: {
    Icon: Warning,
    labelKey: 'notifications.severityHigh',
    colorClass: 'text-warn',
    badgeClass: 'bg-warn-bg text-warn border-warn-border',
  },
  medium: {
    Icon: Info,
    labelKey: 'notifications.severityMedium',
    colorClass: 'text-running',
    badgeClass: 'bg-running-bg text-running border-running-border',
  },
  low: {
    Icon: CheckCircle,
    labelKey: 'notifications.severityLow',
    colorClass: 'text-muted',
    badgeClass: 'bg-canvas text-muted border-border',
  },
}

const CHANNEL_CONFIG: Record<
  NotificationChannel,
  {
    Icon: typeof DeviceMobile
    labelKey: string
  }
> = {
  in_app: { Icon: DeviceMobile, labelKey: 'notifications.channelInApp' },
  slack: { Icon: ChatCircleDots, labelKey: 'notifications.channelSlack' },
  email: { Icon: EnvelopeSimple, labelKey: 'notifications.channelEmail' },
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function NotificationsPage() {
  const { t } = useTranslation()
  const { notifications, unreadCount, markAsRead, toggleRead, markAllAsRead } = useNotifications()
  const projects = useProjects()

  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | 'all'>('all')

  const projectsMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]))
  }, [projects])

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (statusFilter === 'unread' && n.readAt) return false
      if (statusFilter === 'read' && !n.readAt) return false
      if (severityFilter !== 'all' && n.severity !== severityFilter) return false
      return true
    })
  }, [notifications, statusFilter, severityFilter])

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 text-default animate-page-enter">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-default">
              {t('notifications.title')}
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-fail/10 px-2.5 py-0.5 text-xs font-semibold text-fail border border-fail/20">
                {t('notifications.unreadBadge', { count: unreadCount })}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {t('notifications.subtitle')}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead()}
            className="shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Check size={14} weight="bold" aria-hidden="true" />
            <span>{t('notifications.markAllRead')}</span>
          </Button>
        )}
      </header>

      {/* Filter Tabs and Severity Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter status"
          className="inline-flex rounded-lg border border-border bg-canvas/60 p-0.5 text-xs font-medium"
        >
          <button
            role="tab"
            aria-selected={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-surface text-default shadow-xs font-semibold'
                : 'text-muted hover:text-default'
            }`}
          >
            {t('notifications.filterAll')}
          </button>
          <button
            role="tab"
            aria-selected={statusFilter === 'unread'}
            onClick={() => setStatusFilter('unread')}
            className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
              statusFilter === 'unread'
                ? 'bg-surface text-default shadow-xs font-semibold'
                : 'text-muted hover:text-default'
            }`}
          >
            {t('notifications.filterUnread')} ({unreadCount})
          </button>
          <button
            role="tab"
            aria-selected={statusFilter === 'read'}
            onClick={() => setStatusFilter('read')}
            className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
              statusFilter === 'read'
                ? 'bg-surface text-default shadow-xs font-semibold'
                : 'text-muted hover:text-default'
            }`}
          >
            {t('notifications.filterRead')}
          </button>
        </div>

        {/* Severity filter selector */}
        <div className="flex items-center gap-1.5">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as NotificationSeverity | 'all')}
            className="text-xs rounded-lg border border-border bg-surface px-2.5 py-1.5 text-default outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={t('notifications.severityAll')}
          >
            <option value="all">{t('notifications.severityAll')}</option>
            <option value="critical">{t('notifications.severityCritical')}</option>
            <option value="high">{t('notifications.severityHigh')}</option>
            <option value="medium">{t('notifications.severityMedium')}</option>
            <option value="low">{t('notifications.severityLow')}</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <StateView
          kind="empty"
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyDescription')}
          className="mt-6"
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
          {filteredNotifications.map((n) => {
            const severity = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.medium
            const channel = CHANNEL_CONFIG[n.channel] ?? CHANNEL_CONFIG.in_app
            const project = projectsMap.get(n.projectId)
            const isUnread = !n.readAt
            const SeverityIcon = severity.Icon
            const ChannelIcon = channel.Icon

            return (
              <article
                key={n.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 transition-colors ${
                  isUnread ? 'bg-surface hover:bg-surface-hover/60' : 'bg-canvas/30 hover:bg-canvas/60 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <SeverityIcon
                    size={20}
                    weight="fill"
                    className={`mt-0.5 shrink-0 ${severity.colorClass}`}
                    aria-hidden="true"
                  />

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border ${severity.badgeClass}`}>
                        {t(severity.labelKey)}
                      </span>

                      {project && (
                        <span className="inline-flex items-center rounded bg-canvas border border-border px-2 py-0.5 text-[11px] font-medium text-muted">
                          {project.name}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <ChannelIcon size={12} aria-hidden="true" />
                        <span>{t(channel.labelKey)}</span>
                      </span>

                      <span className="text-xs text-muted">·</span>
                      <time className="text-xs text-muted" dateTime={n.createdAt}>
                        {formatDate(n.createdAt)}
                      </time>

                      {isUnread && (
                        <span className="size-2 rounded-full bg-running" aria-label="Unread" />
                      )}
                    </div>

                    <p className={`text-sm leading-relaxed ${isUnread ? 'font-medium text-default' : 'text-muted'}`}>
                      {n.message}
                    </p>
                  </div>
                </div>

                {/* Direct Action and Read/Unread Toggle */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {n.runId && n.projectId && (
                    <Link
                      href={`/projects/${n.projectId}/runs/${n.runId}`}
                      onClick={() => markAsRead(n.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-canvas px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface-hover hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span>{t('notifications.viewRun')}</span>
                      <ArrowSquareOut size={13} aria-hidden="true" />
                    </Link>
                  )}

                  <button
                    onClick={() => toggleRead(n.id)}
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-xs text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer"
                    title={isUnread ? t('notifications.markAsRead') : t('notifications.markAsUnread')}
                    aria-label={isUnread ? t('notifications.markAsRead') : t('notifications.markAsUnread')}
                  >
                    <Check size={16} weight={isUnread ? 'regular' : 'bold'} className={isUnread ? 'text-muted' : 'text-primary'} aria-hidden="true" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

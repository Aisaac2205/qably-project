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
  Check,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react'
import type { NotificationSeverity } from '@qably/types'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { resolveNotificationLink } from '@/features/notifications/lib/resolve-notification-link'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

const SEVERITY_CONFIG: Record<
  NotificationSeverity,
  {
    Icon: typeof WarningOctagon
    labelKey: string
    colorClass: string
    badgeClass: string
    bgClass: string
  }
> = {
  critical: {
    Icon: WarningOctagon,
    labelKey: 'notifications.severityCritical',
    colorClass: 'text-fail',
    badgeClass: 'bg-fail-bg text-fail border-fail/20',
    bgClass: 'bg-fail/10 text-fail',
  },
  high: {
    Icon: Warning,
    labelKey: 'notifications.severityHigh',
    colorClass: 'text-warn',
    badgeClass: 'bg-warn-bg text-warn border-warn/20',
    bgClass: 'bg-warn/10 text-warn',
  },
  medium: {
    Icon: Info,
    labelKey: 'notifications.severityMedium',
    colorClass: 'text-running',
    badgeClass: 'bg-running-bg text-running border-running/20',
    bgClass: 'bg-running/10 text-running',
  },
  low: {
    Icon: CheckCircle,
    labelKey: 'notifications.severityLow',
    colorClass: 'text-muted',
    badgeClass: 'bg-canvas text-muted border-border/80',
    bgClass: 'bg-canvas text-muted',
  },
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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const { projects } = useProjects()

  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const projectsMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]))
  }, [projects])

  const readCount = useMemo(() => {
    return notifications.filter((n) => Boolean(n.readAt)).length
  }, [notifications])

  const messages = useMemo(() => {
    return new Map(
      notifications.map((n) => [n.id, t(`notifications.events.${n.eventType}`, n.payload)]),
    )
  }, [notifications, t])

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (statusFilter === 'unread' && n.readAt) return false
      if (statusFilter === 'read' && !n.readAt) return false
      if (severityFilter !== 'all' && n.severity !== severityFilter) return false
      if (projectFilter !== 'all' && n.projectId !== projectFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchMsg = (messages.get(n.id) ?? '').toLowerCase().includes(q)
        const matchProj = n.projectId
          ? projectsMap.get(n.projectId)?.name.toLowerCase().includes(q)
          : false
        if (!matchMsg && !matchProj) return false
      }
      return true
    })
  }, [notifications, statusFilter, severityFilter, projectFilter, searchQuery, projectsMap, messages])

  const hasActiveFilters = severityFilter !== 'all' || projectFilter !== 'all' || searchQuery.trim().length > 0

  const handleClearFilters = () => {
    setSeverityFilter('all')
    setProjectFilter('all')
    setSearchQuery('')
    setStatusFilter('all')
  }

  return (
    <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 text-default animate-page-enter">
      <h1 className="sr-only">{t('notifications.title')}</h1>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/80">
        <div className="space-y-1.5">
          <p className="text-xs text-muted max-w-2xl">
            {t('notifications.subtitle')}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead()}
            className="shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto active:scale-[0.98] transition-transform text-xs font-medium"
          >
            <Check size={14} weight="bold" aria-hidden="true" />
            <span>{t('notifications.markAllRead')}</span>
          </Button>
        )}
      </header>

      {/* Filter Tabs and Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div
            role="tablist"
            aria-label="Filter status"
            className="inline-flex p-1 rounded-lg border border-border/80 bg-canvas/40 gap-1 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-label={t('notifications.filterAll')}
              aria-selected={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer active:scale-[0.98] ${
                statusFilter === 'all'
                  ? 'bg-surface text-default shadow-2xs font-semibold border border-border/60'
                  : 'text-muted hover:text-default border border-transparent'
              }`}
            >
              <span>{t('notifications.filterAll')}</span>
              <span className="ml-1.5 text-[10px] text-muted">({notifications.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-label={t('notifications.filterUnread')}
              aria-selected={statusFilter === 'unread'}
              onClick={() => setStatusFilter('unread')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer active:scale-[0.98] ${
                statusFilter === 'unread'
                  ? 'bg-surface text-default shadow-2xs font-semibold border border-border/60'
                  : 'text-muted hover:text-default border border-transparent'
              }`}
            >
              <span>{t('notifications.filterUnread')}</span>
              <span className="ml-1.5 text-[10px] font-bold text-primary">({unreadCount})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-label={t('notifications.filterRead')}
              aria-selected={statusFilter === 'read'}
              onClick={() => setStatusFilter('read')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer active:scale-[0.98] ${
                statusFilter === 'read'
                  ? 'bg-surface text-default shadow-2xs font-semibold border border-border/60'
                  : 'text-muted hover:text-default border border-transparent'
              }`}
            >
              <span>{t('notifications.filterRead')}</span>
              <span className="ml-1.5 text-[10px] text-muted">({readCount})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('notifications.searchPlaceholder')}
              className="w-full rounded-lg border border-border/80 bg-surface pl-8 pr-7 py-1.5 text-xs text-default placeholder:text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-default cursor-pointer"
                aria-label="Clear search"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Severity and Project dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as NotificationSeverity | 'all')}
            className="text-xs rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-default outline-none focus:border-primary cursor-pointer hover:border-border"
            aria-label={t('notifications.severityAll')}
          >
            <option value="all">{t('notifications.severityAll')}</option>
            <option value="critical">{t('notifications.severityCritical')}</option>
            <option value="high">{t('notifications.severityHigh')}</option>
            <option value="medium">{t('notifications.severityMedium')}</option>
            <option value="low">{t('notifications.severityLow')}</option>
          </select>

          {projects.length > 1 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-default outline-none focus:border-primary cursor-pointer hover:border-border"
              aria-label={t('notifications.allProjects')}
            >
              <option value="all">{t('notifications.allProjects')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-muted hover:text-default underline transition-colors cursor-pointer ml-1"
            >
              {t('notifications.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface p-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-canvas border border-border text-muted mb-3">
            <Bell size={18} aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-default">
            {hasActiveFilters ? t('notifications.noMatches') : t('notifications.emptyTitle')}
          </h3>
          <p className="mt-1 text-xs text-muted max-w-sm">
            {t('notifications.emptyDescription')}
          </p>
          {hasActiveFilters && (
            <Button size="sm" variant="outline" onClick={handleClearFilters} className="mt-4 text-xs">
              {t('notifications.clearFilters')}
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
          {filteredNotifications.map((n) => {
            const severity = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.medium
            const project = n.projectId ? projectsMap.get(n.projectId) : undefined
            const isUnread = !n.readAt
            const SeverityIcon = severity.Icon
            const link = resolveNotificationLink(n)
            const message = messages.get(n.id) ?? ''

            return (
              <article
                key={n.id}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 transition-colors ${
                  isUnread
                    ? 'bg-surface hover:bg-canvas/30'
                    : 'bg-canvas/20 hover:bg-canvas/50 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Left severity indicator icon */}
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${severity.badgeClass} mt-0.5`}
                  >
                    <SeverityIcon size={16} weight="fill" aria-hidden="true" />
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border ${severity.badgeClass}`}
                      >
                        {t(severity.labelKey)}
                      </span>

                      {project && (
                        <span className="inline-flex items-center rounded bg-canvas border border-border/80 px-2 py-0.5 text-[11px] font-medium text-muted">
                          {project.name}
                        </span>
                      )}

                      <span className="text-muted/60 text-xs">·</span>
                      <time className="text-[11px] text-muted" dateTime={n.createdAt}>
                        {formatDate(n.createdAt)}
                      </time>

                      {isUnread && (
                        <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </div>

                    <p
                      className={`text-sm leading-relaxed ${
                        isUnread ? 'font-semibold text-default' : 'font-normal text-muted'
                      }`}
                    >
                      {message}
                    </p>
                  </div>
                </div>

                {/* Actions: view target & mark as read */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {link && (
                    <Link
                      href={link}
                      onClick={() => isUnread && markAsRead(n.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-canvas/40 px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface hover:border-border transition-colors active:scale-[0.98]"
                    >
                      <span>{t('notifications.viewDetails')}</span>
                      <ArrowSquareOut size={13} aria-hidden="true" />
                    </Link>
                  )}

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="inline-flex size-7 items-center justify-center rounded-lg border border-border/70 bg-canvas/20 text-muted hover:text-default hover:bg-surface hover:border-border transition-all cursor-pointer active:scale-[0.98]"
                      title={t('notifications.markAsRead')}
                      aria-label={t('notifications.markAsRead')}
                    >
                      <Check size={14} weight="regular" className="text-muted" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

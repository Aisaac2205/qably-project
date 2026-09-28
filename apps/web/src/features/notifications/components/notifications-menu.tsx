'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  CaretRight,
  CheckCircle,
  Info,
  Warning,
  WarningOctagon,
} from '@phosphor-icons/react'
import { resolveNotificationEventKey } from '@qably/i18n'
import type { Notification, NotificationSeverity } from '@qably/types'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const severityConfig: Record<
  NotificationSeverity,
  {
    Icon: typeof WarningOctagon
    label: string
    colorClass: string
    bgClass: string
  }
> = {
  critical: {
    Icon: WarningOctagon,
    label: 'Critical',
    colorClass: 'text-fail',
    bgClass: 'bg-fail/10',
  },
  high: {
    Icon: Warning,
    label: 'High',
    colorClass: 'text-warn',
    bgClass: 'bg-warn/10',
  },
  medium: {
    Icon: Info,
    label: 'Medium',
    colorClass: 'text-running',
    bgClass: 'bg-running/10',
  },
  low: {
    Icon: CheckCircle,
    label: 'Low',
    colorClass: 'text-muted',
    bgClass: 'bg-canvas',
  },
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const { t } = useTranslation()
  const config = severityConfig[notification.severity] ?? severityConfig.low
  const { Icon, label, colorClass, bgClass } = config
  const isUnread = !notification.readAt
  const eventKey = resolveNotificationEventKey(notification.eventType, notification.payload)
  const message = t(`notifications.events.${eventKey}`, notification.payload)

  return (
    <MenuItem
      onClick={() => onRead(notification.id)}
      className="notif-item items-start gap-3 rounded-none px-3.5 py-3 hover:bg-surface-hover/80 transition-colors"
      data-unread={isUnread}
    >
      <div className={cn('notif-icon-bubble', colorClass, bgClass)}>
        <Icon size={16} weight="fill" aria-hidden="true" />
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-default">
            {label}
            {isUnread && (
              <span className="size-1.5 rounded-full bg-running" aria-label="Unread" />
            )}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted line-clamp-2 text-wrap-pretty">
          {message}
        </span>
      </span>
    </MenuItem>
  )
}

export function NotificationsMenu() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread')
  const { t } = useTranslation()

  const unreadList = notifications.filter((n) => !n.readAt)
  const readList = notifications.filter((n) => Boolean(n.readAt))
  const activeList = activeTab === 'unread' ? unreadList : readList

  const label =
    unreadCount === 1 ? 'Notifications, 1 unread' : `Notifications, ${unreadCount} unread`

  return (
    <Menu>
      <MenuTrigger
        aria-label={label}
        className="relative flex size-8 items-center justify-center rounded-lg text-default hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary transition-colors cursor-pointer"
      >
        <Bell size={18} aria-hidden="true" />
        <span className="t-badge" data-open={unreadCount > 0 ? 'true' : 'false'}>
          <span className="t-badge-dot">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner align="end">
          <MenuContent className="w-88 p-0 overflow-hidden shadow-pop rounded-xl border border-border bg-surface text-default">
            <div className="notif-menu-header flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-default">{t('notifications.title')}</p>
                <p className="text-[11px] text-muted">{t('notifications.subtitle')}</p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-[11px] font-medium text-primary hover:underline transition-opacity cursor-pointer shrink-0"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>

            <div className="notif-tabs-nav" role="tablist" aria-label="Notification tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'unread'}
                data-active={activeTab === 'unread'}
                onClick={() => setActiveTab('unread')}
                className="notif-tab-btn"
              >
                <span>{t('notifications.filterUnread')}</span>
                <span className="notif-tab-badge">{unreadList.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'read'}
                data-active={activeTab === 'read'}
                onClick={() => setActiveTab('read')}
                className="notif-tab-btn"
              >
                <span>{t('notifications.filterRead')}</span>
                <span className="notif-tab-badge">{readList.length}</span>
              </button>
            </div>

            {activeList.length > 0 ? (
              <div
                className="max-h-88 divide-y divide-border/60 overflow-y-auto"
                aria-label="Notifications"
              >
                {activeList.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <CheckCircle size={28} weight="duotone" className="text-pass opacity-75 mb-1.5" />
                <p className="text-xs font-medium text-default">
                  {t('notifications.emptyTitle')}
                </p>
                <p className="text-[11px] text-muted mt-0.5 max-w-[220px]">
                  {activeTab === 'unread'
                    ? t('notifications.emptyDescription')
                    : 'No read notifications'}
                </p>
              </div>
            )}

            <div className="border-t border-border bg-canvas/30 px-3 py-2 text-center">
              <Link
                href="/notifications"
                className="inline-flex items-center justify-center gap-1 text-xs font-medium text-muted hover:text-default transition-colors"
              >
                {t('notifications.viewDetails')}
                <CaretRight size={12} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </MenuContent>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  )
}

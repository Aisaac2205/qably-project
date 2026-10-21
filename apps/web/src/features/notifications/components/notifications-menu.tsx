'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
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
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { resolveNotificationLink } from '@/features/notifications/lib/resolve-notification-link'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type NotificationTab = 'unread' | 'read'

const severityConfig: Record<
  NotificationSeverity,
  {
    Icon: typeof WarningOctagon
    labelKey: string
    colorClass: string
    bgClass: string
  }
> = {
  critical: {
    Icon: WarningOctagon,
    labelKey: 'notifications.severityCritical',
    colorClass: 'text-fail',
    bgClass: 'bg-fail/10',
  },
  high: {
    Icon: Warning,
    labelKey: 'notifications.severityHigh',
    colorClass: 'text-warn',
    bgClass: 'bg-warn/10',
  },
  medium: {
    Icon: Info,
    labelKey: 'notifications.severityMedium',
    colorClass: 'text-running',
    bgClass: 'bg-running/10',
  },
  low: {
    Icon: CheckCircle,
    labelKey: 'notifications.severityLow',
    colorClass: 'text-muted',
    bgClass: 'bg-canvas',
  },
}

const ROW_CLASS = 'flex w-full items-start gap-3 px-4 py-3 text-left'

const ROW_ACTION_CLASS =
  'cursor-pointer transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover'

// The stylesheet removes the outline of every <button> (a ring takes its place),
// but leaves links their own, so each element gets the focus style that works on
// it. Inset, because the list clips whatever is drawn outside the row.
const ROW_LINK_FOCUS_CLASS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
const ROW_BUTTON_FOCUS_CLASS = 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
const BUTTON_FOCUS_CLASS =
  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification
  onOpen: (notification: Notification) => void
}) {
  const { t, locale } = useTranslation()
  const { Icon, labelKey, colorClass, bgClass } =
    severityConfig[notification.severity] ?? severityConfig.low
  const isUnread = !notification.readAt
  const link = resolveNotificationLink(notification)
  const severityLabel = t(labelKey)
  const eventKey = resolveNotificationEventKey(notification.eventType, notification.payload)
  const message = t(`notifications.events.${eventKey}`, notification.payload)
  const rowName = [isUnread ? t('notifications.unreadState') : '', severityLabel, message]
    .filter(Boolean)
    .join(', ')

  const content = (
    <>
      <span className={cn('notif-icon-bubble', colorClass, bgClass)}>
        <Icon size={16} weight="fill" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-default">
            {severityLabel}
            {isUnread && (
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            )}
          </span>
          <time
            dateTime={notification.createdAt}
            className="shrink-0 text-xs tabular-nums text-muted"
          >
            {formatRelative(notification.createdAt, locale, '')}
          </time>
        </span>
        <span
          className={cn(
            'mt-0.5 line-clamp-2 block text-xs leading-relaxed text-wrap-pretty',
            isUnread ? 'text-default' : 'text-muted',
          )}
        >
          {message}
        </span>
      </span>
    </>
  )

  if (link) {
    return (
      <Link
        href={link}
        aria-label={rowName}
        onClick={() => onOpen(notification)}
        className={cn(ROW_CLASS, ROW_ACTION_CLASS, ROW_LINK_FOCUS_CLASS)}
      >
        {content}
      </Link>
    )
  }

  if (isUnread) {
    return (
      <button
        type="button"
        aria-label={rowName}
        onClick={() => onOpen(notification)}
        className={cn(ROW_CLASS, ROW_ACTION_CLASS, ROW_BUTTON_FOCUS_CLASS)}
      >
        {content}
      </button>
    )
  }

  return <div className={ROW_CLASS}>{content}</div>
}

function TabCount({ value }: { value: number }) {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-hover px-1 text-xs font-medium tabular-nums">
      {value}
    </span>
  )
}

export function NotificationsMenu() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationTab>('unread')
  const { t } = useTranslation()

  const unreadList = notifications.filter((n) => !n.readAt)
  const readList = notifications.filter((n) => Boolean(n.readAt))
  const lists: Record<NotificationTab, Notification[]> = { unread: unreadList, read: readList }

  const label = `${t('notifications.title')}, ${t('notifications.unreadBadge', { count: unreadCount })}`

  function handleOpen(notification: Notification) {
    if (!notification.readAt) markAsRead(notification.id)
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label={label}
        className={cn(
          'relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-default transition-colors hover:bg-surface-hover',
          BUTTON_FOCUS_CLASS,
        )}
      >
        <Bell size={18} aria-hidden="true" />
        <span className="t-badge" data-open={unreadCount > 0 ? 'true' : 'false'} aria-hidden="true">
          <span className="t-badge-dot">{unreadCount > 99 ? '99+' : unreadCount}</span>
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner align="end" sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            className={cn(
              'w-88 max-w-screen origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-surface text-default shadow-pop',
              'transition-[opacity,transform] duration-150 ease-out',
              'data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
            )}
          >
            <div className="notif-menu-header">
              <div className="flex items-center justify-between gap-3">
                <PopoverPrimitive.Title className="text-sm font-semibold text-default">
                  {t('notifications.title')}
                </PopoverPrimitive.Title>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className={cn(
                      'shrink-0 cursor-pointer rounded text-xs font-medium text-primary hover:underline',
                      BUTTON_FOCUS_CLASS,
                    )}
                  >
                    {t('notifications.markAllRead')}
                  </button>
                )}
              </div>
              <PopoverPrimitive.Description className="mt-0.5 text-xs text-muted text-wrap-pretty">
                {t('notifications.subtitle')}
              </PopoverPrimitive.Description>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value === 'read' ? 'read' : 'unread')}
              className="gap-0"
            >
              <TabsList
                aria-label={t('notifications.filterStatus')}
                className="w-full gap-1 bg-canvas px-3"
              >
                <TabsTab value="unread" className="gap-1.5 px-2 py-1.5 text-xs md:min-h-9">
                  {t('notifications.filterUnread')}
                  <TabCount value={unreadList.length} />
                </TabsTab>
                <TabsTab value="read" className="gap-1.5 px-2 py-1.5 text-xs md:min-h-9">
                  {t('notifications.filterRead')}
                  <TabCount value={readList.length} />
                </TabsTab>
              </TabsList>

              {(['unread', 'read'] as const).map((tab) => (
                <TabsPanel
                  key={tab}
                  value={tab}
                  tabIndex={lists[tab].length > 0 ? -1 : 0}
                  className="focus-visible:ring-inset focus-visible:ring-offset-0"
                >
                  {lists[tab].length > 0 ? (
                    <ul className="max-h-88 divide-y divide-border/60 overflow-y-auto">
                      {lists[tab].map((notification) => (
                        <li key={notification.id}>
                          <NotificationRow notification={notification} onOpen={handleOpen} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <CheckCircle
                        size={28}
                        weight="duotone"
                        aria-hidden="true"
                        className="mb-1.5 text-pass opacity-75"
                      />
                      <p className="text-xs font-medium text-default">
                        {t('notifications.emptyTitle')}
                      </p>
                      <p className="mt-0.5 max-w-56 text-xs text-muted">
                        {tab === 'unread'
                          ? t('notifications.emptyDescription')
                          : t('notifications.emptyRead')}
                      </p>
                    </div>
                  )}
                </TabsPanel>
              ))}
            </Tabs>

            <div className="border-t border-border bg-canvas/30 px-3 py-2 text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1 rounded text-xs font-medium text-muted transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {t('notifications.viewDetails')}
                <CaretRight size={12} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

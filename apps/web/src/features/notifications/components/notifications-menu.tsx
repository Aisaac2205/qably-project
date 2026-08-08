'use client'

import {
  Bell,
  CheckCircle,
  Info,
  Warning,
  WarningOctagon,
} from '@phosphor-icons/react'
import type { Notification, NotificationSeverity } from '@qably/types'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'

const severityConfig: Record<NotificationSeverity, {
  Icon: typeof WarningOctagon
  label: string
  className: string
}> = {
  critical: { Icon: WarningOctagon, label: 'Critical', className: 'text-fail' },
  high: { Icon: Warning, label: 'High', className: 'text-warn' },
  medium: { Icon: Info, label: 'Medium', className: 'text-running' },
  low: { Icon: CheckCircle, label: 'Low', className: 'text-muted' },
}

function NotificationItem({ notification, onRead }: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const { Icon, label, className } = severityConfig[notification.severity]
  const isUnread = !notification.readAt

  return (
    <MenuItem onClick={() => onRead(notification.id)} className="items-start gap-2.5 rounded-none px-3 py-2.5">
      <Icon size={16} weight="fill" className={`mt-0.5 shrink-0 ${className}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-default">
          {label}
          {isUnread && <span className="size-1.5 rounded-full bg-running" aria-label="Unread" />}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{notification.message}</span>
      </span>
    </MenuItem>
  )
}

export function NotificationsMenu() {
  const { notifications, unreadCount, markAsRead } = useNotifications()
  const label = unreadCount === 1 ? 'Notifications, 1 unread' : `Notifications, ${unreadCount} unread`

  return (
    <Menu>
      <MenuTrigger
        aria-label={label}
        className="relative flex size-8 items-center justify-center rounded-lg text-default hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-fail px-1 text-center font-mono text-[10px] leading-4 text-primary-fg" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner align="end">
          <MenuContent className="w-80 p-0">
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold text-default">Notifications</p>
              <p className="text-xs text-muted">Critical failures and review alerts</p>
            </div>
            {notifications.length > 0 ? (
              <div className="max-h-96 divide-y divide-border overflow-y-auto" aria-label="Notifications">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} onRead={markAsRead} />
                ))}
              </div>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted">No notifications</p>
            )}
          </MenuContent>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  )
}

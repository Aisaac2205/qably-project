'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Notification } from '@qably/types'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { resolveNotificationLink } from '@/features/notifications/lib/resolve-notification-link'
import { useTranslation } from '@/lib/i18n'
import { notify } from '@/lib/notify'

const SHORT_SHA_LENGTH = 7

const SOURCE_COPY_KEY: Record<string, string> = {
  documentation: 'notifications.toast.proposalsDocumentation',
  chat: 'notifications.toast.proposalsChat',
}

function payloadText(notification: Notification, key: string): string {
  const value = notification.payload[key]
  return value === undefined ? '' : String(value).trim()
}

function isNewBatch(notification: Notification): boolean {
  return notification.eventType === 'proposals_ready' && !notification.readAt
}

/**
 * Raises one toast for each proposals_ready notification that shows up while
 * the app is open, so a push that lands 18 proposals in the review inbox does
 * not wait for someone to open the bell.
 *
 * Mount it once, in the app shell. The first response only records what is
 * already there: opening the app must not replay every unread batch. A
 * notification is announced once per id, even when the backend later recounts
 * the same batch in place.
 */
export function useProposalBatchToasts(): void {
  const { notifications, hasLoaded, markAsRead } = useNotifications()
  const { t } = useTranslation()
  const router = useRouter()
  const seenIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!hasLoaded) {
      // No response yet, or the cache was reset (the organization changed):
      // whatever arrives next is a fresh baseline, not news.
      seenIds.current = null
      return
    }

    if (seenIds.current === null) {
      seenIds.current = new Set(notifications.map((notification) => notification.id))
      return
    }

    for (const notification of notifications) {
      if (seenIds.current.has(notification.id)) continue
      seenIds.current.add(notification.id)
      if (!isNewBatch(notification)) continue

      const count = Number(notification.payload.count)
      const sha = payloadText(notification, 'commitSha').slice(0, SHORT_SHA_LENGTH)
      const source = payloadText(notification, 'source')
      const isPush = source === 'push' && sha !== ''
      const copyKey = isPush ? 'notifications.toast.proposalsPush' : SOURCE_COPY_KEY[source]

      const title = copyKey
        ? t(copyKey, { count, sha })
        : t('notifications.events.proposals_ready', { count })
      const description = isPush
        ? [payloadText(notification, 'branch'), payloadText(notification, 'author')]
            .filter(Boolean)
            .join(' · ')
        : ''
      const link = resolveNotificationLink(notification)

      notify.info(title, {
        id: notification.id,
        ...(description === '' ? {} : { description }),
        ...(link === undefined
          ? {}
          : {
              action: {
                label: t('notifications.toast.view'),
                onClick: () => {
                  markAsRead(notification.id)
                  router.push(link)
                },
              },
            }),
      })
    }
  }, [notifications, hasLoaded, markAsRead, router, t])
}

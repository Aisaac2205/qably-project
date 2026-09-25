'use client'

import { Warning } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

interface InboxCollisionsNoticeProps {
  openCollisions: number
}

export function InboxCollisionsNotice({ openCollisions }: InboxCollisionsNoticeProps) {
  const { t } = useTranslation()

  if (openCollisions === 0) return null

  return (
    <div
      role="status"
      className="flex items-start gap-1.5 rounded-xl border border-warn/40 bg-warn-bg/60 p-3"
    >
      <Warning size={14} weight="bold" className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
      <p className="text-sm text-default leading-relaxed">
        {t('reviewInbox.openCollisions', { count: openCollisions })}
      </p>
    </div>
  )
}

'use client'

import { Bell } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export default function NotificationsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col px-4 py-6 sm:px-6">
      <div className="max-w-2xl">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-muted">
          <Bell size={20} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-default">{t('notifications.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('notifications.subtitle')}</p>
        <section className="mt-6 rounded-xl border border-border bg-surface px-5 py-4" aria-labelledby="notifications-temporary-heading">
          <h2 id="notifications-temporary-heading" className="text-sm font-semibold text-default">{t('notifications.temporaryTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('notifications.temporaryDescription')}</p>
        </section>
      </div>
    </div>
  )
}

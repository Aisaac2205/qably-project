'use client'

import { Tray } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export default function ReviewInboxPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col px-4 py-6 sm:px-6">
      <div className="max-w-2xl">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-muted">
          <Tray size={20} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-default">{t('reviewInbox.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('reviewInbox.subtitle')}</p>
        <section className="mt-6 rounded-xl border border-border bg-surface px-5 py-4" aria-labelledby="review-inbox-temporary-heading">
          <h2 id="review-inbox-temporary-heading" className="text-sm font-semibold text-default">{t('reviewInbox.temporaryTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('reviewInbox.temporaryDescription')}</p>
        </section>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

/**
 * `/integrations` no longer concentrates operational flows (Phase 2 exit
 * condition). CI adapters live in Project Runs, SCM sources live in
 * Project Repository, and credentials/governance live in Settings.
 */
export default function IntegrationsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t('modules.integrations.title')}</h1>
      <div className="max-w-2xl">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-muted">
          <ArrowSquareOut size={20} aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm text-muted">{t('modules.integrations.subtitle')}</p>

        <section className="mt-6 rounded-xl border border-border bg-surface px-5 py-4" aria-labelledby="integrations-moved-heading">
          <h2 id="integrations-moved-heading" className="text-sm font-semibold text-default">
            {t('modules.integrations.movedHeading')}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>{t('modules.integrations.movedCiText')}</li>
            <li>{t('modules.integrations.movedScmText')}</li>
            <li>{t('modules.integrations.movedCredentialsText')}</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              href="/projects"
              className="text-sm font-medium text-default underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('common.projects')}
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium text-default underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('sidebar.settings')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

'use client'

import { GithubLogo } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/page-header'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { mockRepositorySources } from '@/lib/mock-data'

export function ProjectRepositoryPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const source = mockRepositorySources[projectId]

  return (
    <div className="px-4 py-6 sm:px-6">
      <PageHeader title={t('repository.title')} description={t('repository.subtitle')} />

      {source ? (
        <section className="mt-6 max-w-2xl rounded-xl border border-border bg-surface px-5 py-4" aria-labelledby="repository-source-heading">
          <h2 id="repository-source-heading" className="text-sm font-semibold text-default">
            {t('repository.sourceHeading')}
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted">
              <GithubLogo size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-default">{source.provider}</p>
              <p className="text-sm text-muted">{source.repository}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">{t('repository.simulatedDescription')}</p>
        </section>
      ) : (
        <div className="mt-6">
          <StateView
            kind="no-source"
            title={t('repository.noSourceTitle')}
            description={t('repository.noSourceDescription')}
          />
        </div>
      )}
    </div>
  )
}

'use client'

import { GithubLogo } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/page-header'
import { InspectorPanel } from '@/components/ui/inspector-panel'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { mockRepositorySources } from '@/lib/mock-data'
import { useCodeChanges, useEvidence, useIngestionBatches } from '@/lib/use-mock-store'
import { selectDetectedTestChanges } from '../lib/test-file-patterns'

function formatTimestamp(timestamp: string, locale: 'en' | 'es') {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp))
}

export function ProjectRepositoryPage({ projectId }: { projectId: string }) {
  const { t, locale } = useTranslation()
  const source = mockRepositorySources[projectId]
  const batches = useIngestionBatches(projectId)
  const changes = useCodeChanges(projectId)
  const batch = batches[0]
  const change = batch ? changes.find((item) => batch.codeChangeIds.includes(item.id)) : undefined
  const evidence = useEvidence(change?.evidenceId)
  const batchChanges = batch ? changes.filter((item) => batch.codeChangeIds.includes(item.id)) : []
  const detectedTests = source ? selectDetectedTestChanges(batchChanges, source.testFilePatterns) : []

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

      {batch && change && evidence ? (
        <section className="mt-6 max-w-3xl" aria-labelledby="repository-ingestion-heading">
          <h2 id="repository-ingestion-heading" className="text-sm font-semibold text-default">
            {t('repository.ingestionHeading')}
          </h2>
          <dl className="mt-3 grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">{t('repository.ingestionSource')}</dt>
              <dd className="mt-1 font-medium text-default">{t(`repository.source${batch.source === 'repository' ? 'Repository' : 'Webhook'}`)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('repository.ingestionStatus')}</dt>
              <dd className="mt-1 font-medium text-default">{t(`repository.status${batch.status === 'completed' ? 'Completed' : batch.status === 'pending' ? 'Pending' : 'Failed'}`)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('repository.ingestionCreated')}</dt>
              <dd className="mt-1 font-medium text-default">{formatTimestamp(batch.createdAt, locale)}</dd>
            </div>
          </dl>
          <InspectorPanel title={t('repository.inspectorHeading')} className="mt-4">
            <dl className="grid gap-3 p-5 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">{t('repository.pullRequest')}</dt>
              <dd className="font-medium text-default">PR #{change.pullRequestNumber}</dd>
              <dt className="text-muted">{t('repository.commit')}</dt>
              <dd className="font-mono text-default">{change.commitSha.slice(0, 7)}</dd>
              <dt className="text-muted">{t('repository.file')}</dt>
              <dd className="min-w-0 break-all text-default">{change.filePath}</dd>
              <dt className="text-muted">{t('repository.diff')}</dt>
              <dd className="min-w-0 overflow-x-auto rounded border border-border bg-canvas p-3 font-mono text-xs text-default"><pre>{change.diff}</pre></dd>
              <dt className="text-muted">{t('repository.origin')}</dt>
              <dd className="min-w-0 break-all text-default">{evidence.uri}</dd>
            </dl>
          </InspectorPanel>
          <section className="mt-4 rounded-lg border border-border bg-surface p-4" aria-labelledby="repository-detected-tests-heading">
            <h3 id="repository-detected-tests-heading" className="text-sm font-semibold text-default">
              {t('repository.detectedTestsHeading')}
            </h3>
            <p className="mt-1 text-sm text-muted">{t('repository.detectedTestsDescription')}</p>
            <ul className="mt-4 space-y-3" aria-label={t('repository.detectedTestsHeading')}>
              {detectedTests.map((detectedChange) => (
                <li key={detectedChange.id} className="min-w-0 rounded-md border border-border px-3 py-2 sm:flex sm:items-start sm:justify-between sm:gap-4">
                  <p className="min-w-0 break-all text-sm text-default">{detectedChange.filePath}</p>
                  <p className="mt-2 shrink-0 text-sm text-muted sm:mt-0">
                    {t('repository.detectedPattern')}: <code className="break-all font-mono text-default">{detectedChange.detectedPattern}</code>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </section>
      ) : null}
    </div>
  )
}

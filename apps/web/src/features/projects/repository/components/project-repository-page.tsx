'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { CodeChange } from '@qably/types'
import { PageHeader } from '@/components/ui/page-header'
import { InspectorPanel } from '@/components/ui/inspector-panel'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { mockRepositorySources } from '@/lib/mock-data'
import { useCodeChanges, useEvidence, useIngestionBatches, useProposal, useTraceabilityLinks } from '@/lib/use-mock-store'
import { selectDetectedTestChanges } from '../lib/test-file-patterns'

function DetectedTestItem({
  detectedChange,
  projectId,
}: {
  detectedChange: CodeChange & { detectedPattern: string }
  projectId: string
}) {
  const { t } = useTranslation()
  const links = useTraceabilityLinks(detectedChange.id)
  const proposalLink = links.find(
    (link) => link.relation === 'produced' && link.from.id === detectedChange.id && link.to.type === 'proposal',
  )
  const proposal = useProposal(proposalLink?.to.id ?? '')
  const originEvidence = useEvidence(detectedChange.evidenceId)

  return (
    <li className="min-w-0 rounded-lg border border-border bg-canvas/40 p-4 transition-colors hover:border-border hover:bg-canvas/70 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="min-w-0 break-all font-mono text-xs sm:text-sm font-medium text-default">{detectedChange.filePath}</p>
        <p className="shrink-0 text-xs text-muted">
          {t('repository.detectedPattern')}: <code className="break-all font-mono text-default font-semibold bg-surface px-1.5 py-0.5 rounded border border-border/80 text-xs">{detectedChange.detectedPattern}</code>
        </p>
      </div>
      {originEvidence ? (
        <p className="w-full min-w-0 text-xs text-muted flex items-start gap-1.5 rounded-md bg-surface/80 px-2.5 py-1.5 border border-border/60">
          <span className="font-medium shrink-0">{t('repository.origin')}: </span>
          <span className="min-w-0 break-all font-mono text-default">{originEvidence.uri}</span>
        </p>
      ) : null}
      {proposal ? (
        <div className="rounded-lg border border-border/80 bg-surface p-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{t('repository.linkedProposal')}</p>
            <p className="text-sm font-semibold text-default mt-0.5">{proposal.title}</p>
          </div>
          <Link
            href={`/projects/${projectId}/ai-review`}
            className="mt-2 sm:mt-0 inline-flex shrink-0 items-center text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary transition-colors"
          >
            {t('sidebar.aiReview')}
          </Link>
        </div>
      ) : null}
    </li>
  )
}

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
  const [patternFilter, setPatternFilter] = useState<string>('all')
  const visibleDetectedTests = patternFilter === 'all'
    ? detectedTests
    : detectedTests.filter((item) => item.detectedPattern === patternFilter)

  return (
    <div className="max-w-5xl 2xl:max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-page-enter">
      <PageHeader title={t('repository.title')} description={t('repository.subtitle')} />

      {source ? (
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card" aria-labelledby="repository-source-heading">
          <h2 id="repository-source-heading" className="text-base font-semibold text-default">
            {t('repository.sourceHeading')}
          </h2>
          <div className="mt-4 flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas/60 p-2.5 text-default">
              <Image src="/logos/github.svg" alt="" width={22} height={22} className="size-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-default">{source.provider}</p>
              <p className="text-xs sm:text-sm font-mono text-muted truncate">{source.repository}</p>
            </div>
          </div>
          <p className="mt-4 text-xs sm:text-sm text-muted rounded-lg border border-border/60 bg-canvas/40 p-3">
            {t('repository.simulatedDescription')}
          </p>
        </section>
      ) : (
        <StateView
          kind="no-source"
          title={t('repository.noSourceTitle')}
          description={t('repository.noSourceDescription')}
        />
      )}

      {batch ? (
        <section className="space-y-6" aria-labelledby="repository-ingestion-heading">
          <div className="space-y-3">
            <h2 id="repository-ingestion-heading" className="text-base font-semibold text-default">
              {t('repository.ingestionHeading')}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              <dl className="grid grid-cols-1 divide-y divide-border text-sm sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                <div className="p-4 sm:p-5">
                  <dt className="text-xs font-medium text-muted">{t('repository.ingestionSource')}</dt>
                  <dd className="mt-1 font-semibold text-default">{t(`repository.source${batch.source === 'repository' ? 'Repository' : 'Webhook'}`)}</dd>
                </div>
                <div className="p-4 sm:p-5">
                  <dt className="text-xs font-medium text-muted">{t('repository.ingestionStatus')}</dt>
                  <dd className="mt-1 font-semibold text-default">{t(`repository.status${batch.status === 'completed' ? 'Completed' : batch.status === 'pending' ? 'Pending' : 'Failed'}`)}</dd>
                </div>
                <div className="p-4 sm:p-5">
                  <dt className="text-xs font-medium text-muted">{t('repository.ingestionCreated')}</dt>
                  <dd className="mt-1 font-medium text-default text-xs sm:text-sm">{formatTimestamp(batch.createdAt, locale)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {batch.status === 'failed' ? (
            <StateView
              kind="error"
              title={t('repository.ingestionErrorTitle')}
              description={t('repository.ingestionErrorDescription')}
            />
          ) : change && evidence ? (
            <>
              <InspectorPanel title={t('repository.inspectorHeading')} className="shadow-card">
                <dl className="grid gap-3.5 p-5 text-sm sm:grid-cols-[160px_1fr] sm:items-baseline">
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.pullRequest')}</dt>
                  <dd className="font-semibold text-default">PR #{change.pullRequestNumber}</dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.commit')}</dt>
                  <dd className="font-mono text-xs font-medium text-default bg-canvas/80 px-2 py-0.5 rounded border border-border w-fit">{change.commitSha.slice(0, 7)}</dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.file')}</dt>
                  <dd className="min-w-0 break-all font-mono text-xs sm:text-sm text-default font-medium">{change.filePath}</dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.diff')}</dt>
                  <dd className="min-w-0 overflow-x-auto rounded-lg border border-border bg-canvas p-3.5 font-mono text-xs text-default leading-relaxed"><pre className="font-mono">{change.diff}</pre></dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.origin')}</dt>
                  <dd className="min-w-0 break-all font-mono text-xs text-muted bg-canvas/40 px-2.5 py-1.5 rounded border border-border/60">{evidence.uri}</dd>
                </dl>
              </InspectorPanel>

              <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4" aria-labelledby="repository-detected-tests-heading">
                <div>
                  <h3 id="repository-detected-tests-heading" className="text-sm font-semibold text-default">
                    {t('repository.detectedTestsHeading')}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted">{t('repository.detectedTestsDescription')}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-canvas border border-border/60 w-fit" role="group" aria-label={t('repository.detectedPattern')}>
                  <button
                    type="button"
                    aria-pressed={patternFilter === 'all'}
                    onClick={() => setPatternFilter('all')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary ${
                      patternFilter === 'all'
                        ? 'bg-surface text-default font-semibold shadow-xs border border-border'
                        : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent'
                    }`}
                  >
                    {t('repository.filterAll')}
                  </button>
                  {source?.testFilePatterns.map((pattern) => (
                    <button
                      key={pattern}
                      type="button"
                      aria-pressed={patternFilter === pattern}
                      onClick={() => setPatternFilter(pattern)}
                      className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary ${
                        patternFilter === pattern
                          ? 'bg-surface text-default font-semibold shadow-xs border border-border'
                          : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent'
                      }`}
                    >
                      {pattern}
                    </button>
                  ))}
                </div>

                <ul className="space-y-3 pt-1" aria-label={t('repository.detectedTestsHeading')}>
                  {visibleDetectedTests.map((detectedChange) => (
                    <DetectedTestItem key={detectedChange.id} detectedChange={detectedChange} projectId={projectId} />
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

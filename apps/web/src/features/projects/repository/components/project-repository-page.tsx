'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowSquareOut,
  FileCode,
  Sparkle,
} from '@phosphor-icons/react'
import type { CodeChange, Evidence } from '@qably/types'
import { PageHeader } from '@/components/ui/page-header'
import { InspectorPanel } from '@/components/ui/inspector-panel'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { useProposal, useTraceabilityLinks } from '@/lib/use-mock-store'
import { useProjectRepository } from '../hooks/use-project-repository'
import { selectDetectedTestChanges } from '../lib/test-file-patterns'

function DetectedTestItem({
  detectedChange,
  originEvidence,
  projectId,
}: {
  detectedChange: CodeChange & { detectedPattern: string }
  originEvidence?: Evidence
  projectId: string
}) {
  const { t } = useTranslation()
  const links = useTraceabilityLinks(detectedChange.id)
  const proposalLink = links.find(
    (link) => link.relation === 'produced' && link.from.id === detectedChange.id && link.to.type === 'proposal',
  )
  const proposal = useProposal(proposalLink?.to.id ?? '')

  return (
    <li className="min-w-0 rounded-2xl border border-border/70 bg-surface p-4 sm:p-5 transition-all duration-150 hover:border-border hover:shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas border border-border/60 text-muted">
            <FileCode size={15} />
          </div>
          <p className="min-w-0 break-all text-xs sm:text-sm font-semibold text-default tracking-tight">
            {detectedChange.filePath}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted">
          <span>{t('repository.detectedPattern')}:</span>
          <span className="font-mono text-xs font-semibold text-default bg-canvas px-2 py-0.5 rounded-md border border-border/80">
            {detectedChange.detectedPattern}
          </span>
        </div>
      </div>

      {originEvidence ? (
        <div className="w-full min-w-0 text-xs text-muted flex items-start gap-1.5 rounded-xl bg-canvas/60 px-3 py-2 border border-border/50">
          <span className="font-medium shrink-0">{t('repository.origin')}:</span>
          <a
            href={originEvidence.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 break-all text-default hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <span>{originEvidence.uri}</span>
            <ArrowSquareOut size={12} className="shrink-0 text-muted" />
          </a>
        </div>
      ) : null}

      {proposal ? (
        <div className="rounded-xl border border-border/80 bg-canvas/40 p-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Sparkle size={13} className="text-accent-ai" />
              <span>{t('repository.linkedProposal')}</span>
            </div>
            <p className="text-sm font-semibold text-default mt-1">{proposal.title}</p>
          </div>
          <Link
            href={`/projects/${projectId}/ai-review`}
            className="mt-2 sm:mt-0 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary transition-colors"
          >
            <span>{t('sidebar.aiReview')}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : null}
    </li>
  )
}

const PROVIDER_LABEL = { GITHUB: 'GitHub', BITBUCKET: 'Bitbucket' } as const

function formatTimestamp(timestamp: string, locale: 'en' | 'es') {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp))
}

export function ProjectRepositoryPage({ projectId }: { projectId: string }) {
  const { t, locale } = useTranslation()
  const { repository, isLoading, isError } = useProjectRepository(projectId)
  const [patternFilter, setPatternFilter] = useState<string>('all')
  const source = repository?.source ?? undefined
  const batch = repository?.batch ?? undefined
  const batchChanges = repository?.codeChanges ?? []
  const evidenceById = new Map((repository?.evidence ?? []).map((item) => [item.id, item]))
  const change = batchChanges[0]
  const evidence = change ? evidenceById.get(change.evidenceId) : undefined
  const detectedTests = source ? selectDetectedTestChanges(batchChanges, source.testFilePatterns) : []
  const visibleDetectedTests = patternFilter === 'all'
    ? detectedTests
    : detectedTests.filter((item) => item.detectedPattern === patternFilter)

  if (isLoading) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6">
        <PageHeader title={t('repository.title')} description={t('repository.subtitle')} />
        <StateView kind="loading" title={t('repository.loadingTitle')} />
      </div>
    )
  }

  if (isError || repository === undefined) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6">
        <PageHeader title={t('repository.title')} description={t('repository.subtitle')} />
        <StateView
          kind="error"
          title={t('repository.loadErrorTitle')}
          description={t('repository.loadErrorDescription')}
        />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <PageHeader title={t('repository.title')} description={t('repository.subtitle')} />

      {source ? (
        <section className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-7 shadow-xs hover:border-border transition-all duration-200 space-y-4" aria-labelledby="repository-source-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-canvas/80 p-2.5 text-default shadow-2xs">
                <Image src="/logos/github.svg" alt="" width={22} height={22} className="size-full object-contain" />
              </div>
              <div className="min-w-0">
                <h2 id="repository-source-heading" className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {PROVIDER_LABEL[source.provider]}
                </h2>
                <p className="text-base sm:text-lg font-bold text-default tracking-tight truncate mt-0.5">
                  {source.repo}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                <span>{locale === 'es' ? 'Sincronización activa' : 'Active sync'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/50 text-xs sm:text-sm text-muted">
            <p>{t('repository.sourceDescription')}</p>
            {source.testFilePatterns?.length ? (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {source.testFilePatterns.map((pat) => (
                  <span key={pat} className="font-mono text-2xs px-2 py-0.5 rounded-md bg-canvas border border-border/60 text-muted">
                    {pat}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
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
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-xs">
              <dl className="grid grid-cols-1 divide-y divide-border/60 text-sm sm:grid-cols-3 sm:divide-y-0 sm:divide-x sm:divide-border/60">
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
              <InspectorPanel title={t('repository.inspectorHeading')} className="shadow-xs rounded-2xl">
                <dl className="grid gap-3.5 p-5 sm:p-6 text-sm sm:grid-cols-[160px_1fr] sm:items-baseline">
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.pullRequest')}</dt>
                  <dd className="font-semibold text-default">PR #{change.pullRequestNumber}</dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.commit')}</dt>
                  <dd className="font-mono text-xs font-medium text-default bg-canvas/80 px-2 py-0.5 rounded-md border border-border w-fit">{change.commitSha.slice(0, 7)}</dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.file')}</dt>
                  <dd className="min-w-0 break-all text-xs sm:text-sm text-default font-medium">{change.filePath}</dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.diff')}</dt>
                  <dd className="min-w-0 overflow-x-auto rounded-xl border border-border/80 bg-canvas p-4 font-mono text-xs text-default leading-relaxed"><pre className="font-mono">{change.diff}</pre></dd>
                  <dt className="text-xs font-medium text-muted sm:text-right sm:pr-2">{t('repository.origin')}</dt>
                  <dd className="min-w-0 break-all text-xs text-muted bg-canvas/40 px-3 py-1.5 rounded-lg border border-border/60">{evidence.uri}</dd>
                </dl>
              </InspectorPanel>

              <section className="rounded-2xl border border-border/70 bg-surface p-5 sm:p-6 shadow-xs space-y-4" aria-labelledby="repository-detected-tests-heading">
                <div>
                  <h3 id="repository-detected-tests-heading" className="text-sm font-semibold text-default">
                    {t('repository.detectedTestsHeading')}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted">{t('repository.detectedTestsDescription')}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-canvas border border-border/60 w-fit" role="group" aria-label={t('repository.detectedPattern')}>
                  <button
                    type="button"
                    aria-pressed={patternFilter === 'all'}
                    onClick={() => setPatternFilter('all')}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary ${
                      patternFilter === 'all'
                        ? 'bg-surface text-default font-semibold shadow-xs border border-border/80'
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
                      className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary ${
                        patternFilter === pattern
                          ? 'bg-surface text-default font-semibold shadow-xs border border-border/80'
                          : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent'
                      }`}
                    >
                      {pattern}
                    </button>
                  ))}
                </div>

                <ul className="space-y-3 pt-1" aria-label={t('repository.detectedTestsHeading')}>
                  {visibleDetectedTests.map((detectedChange) => (
                    <DetectedTestItem
                      key={detectedChange.id}
                      detectedChange={detectedChange}
                      originEvidence={evidenceById.get(detectedChange.evidenceId)}
                      projectId={projectId}
                    />
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </section>
      ) : source ? (
        <StateView
          kind="empty"
          title={t('repository.emptyBatchTitle')}
          description={t('repository.emptyBatchDescription')}
          className="rounded-2xl border border-dashed border-border/70 bg-surface/50 p-8 sm:p-12 text-center"
        />
      ) : null}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowSquareOut,
  Code,
  Sparkle,
} from '@phosphor-icons/react'
import type { CodeChange, Evidence } from '@qably/types'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EntityList } from '@/components/ui/entity-list'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { StateView } from '@/components/ui/state-view'
import { WebhookSetupPanel } from '@/features/integrations'
import { useTranslation } from '@/lib/i18n'
import { projectRootPath, reviewInboxPath } from '@/features/projects/lib/routes'
import { useProposal, useTraceabilityLinks } from '@/lib/use-mock-store'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProjectRepository } from '../hooks/use-project-repository'
import { matchDeclaredTestPattern } from '../lib/test-file-patterns'
import { deriveRepositoryLinks } from '../lib/repository-links'
import { TestFilePatternsEditor } from './test-file-patterns-editor'

function ChangedFileItem({
  change,
  detectedPattern,
  originEvidence,
  projectId,
}: {
  change: CodeChange
  detectedPattern: string | null
  originEvidence?: Evidence
  projectId: string
}) {
  const { t } = useTranslation()
  const links = useTraceabilityLinks(change.id)
  const proposalLink = links.find(
    (link) => link.relation === 'produced' && link.from.id === change.id && link.to.type === 'proposal',
  )
  const proposal = useProposal(proposalLink?.to.id ?? '')

  return (
    <li className="min-w-0 py-3.5 sm:py-4 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Code size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <p className="min-w-0 break-all text-xs sm:text-sm font-semibold text-default tracking-tight">
            {change.filePath}
          </p>
        </div>
        {detectedPattern ? (
          <span className="shrink-0 font-mono text-2xs px-2 py-0.5 rounded-md bg-canvas border border-border/80 text-muted">
            {detectedPattern}
          </span>
        ) : null}
      </div>

      {originEvidence ? (
        <a
          href={originEvidence.uri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-6 items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-md"
        >
          <span>{t('repository.viewFile')}</span>
          <ArrowSquareOut size={12} aria-hidden="true" className="shrink-0" />
        </a>
      ) : null}

      {proposal ? (
        <div className="rounded-lg border border-border/80 bg-canvas/40 p-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Sparkle size={13} className="text-accent-ai" />
              <span>{t('repository.linkedProposal')}</span>
            </div>
            <p className="text-sm font-semibold text-default mt-1">{proposal.title}</p>
          </div>
          <Link
            href={reviewInboxPath(projectId)}
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
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp))
}

export function ProjectRepositoryPage({ projectId }: { projectId: string }) {
  const { t, locale } = useTranslation()
  const { project } = useProject(projectId)
  const { repository, isLoading, isError } = useProjectRepository(projectId)
  const [patternFilter, setPatternFilter] = useState<string>('all')
  const [setupOpen, setSetupOpen] = useState(false)
  const source = repository?.source ?? undefined
  const batch = repository?.batch ?? undefined
  const batchChanges = repository?.codeChanges ?? []
  const evidenceById = new Map((repository?.evidence ?? []).map((item) => [item.id, item]))
  const changedFiles = batchChanges.map((item) => ({
    change: item,
    detectedPattern: source
      ? (matchDeclaredTestPattern(item.filePath, source.testFilePatterns) ?? null)
      : null,
  }))
  const detectedCount = changedFiles.filter((item) => item.detectedPattern !== null).length
  const visibleFiles = patternFilter === 'all'
    ? changedFiles
    : changedFiles.filter((item) => item.detectedPattern === patternFilter)
  const commitSha = batchChanges[0]?.commitSha
  const primaryEvidence = batchChanges[0] ? evidenceById.get(batchChanges[0].evidenceId) : undefined
  const { repoUrl, commitUrl } = deriveRepositoryLinks(primaryEvidence?.uri, commitSha)

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: t('suites.breadcrumbProjects'), href: '/projects' },
        ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
        { label: t('repository.title') },
      ]}
    />
  )

  if (isLoading) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6">
        {breadcrumbs}
        <p className="text-sm text-muted">{t('repository.subtitle')}</p>
        <StateView kind="loading" title={t('repository.loadingTitle')} />
      </div>
    )
  }

  if (isError || repository === undefined) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6">
        {breadcrumbs}
        <p className="text-sm text-muted">{t('repository.subtitle')}</p>
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
      <div className="space-y-1">
        {breadcrumbs}
        <h1 className="sr-only">{t('repository.title')}</h1>
        <p className="text-sm text-muted">{t('repository.subtitle')}</p>
      </div>

      {source ? (
        <section className="rule-bleed space-y-4 border-y border-border py-5 sm:py-6" aria-labelledby="repository-source-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-canvas/80 p-2.5 text-default">
                <Image src={`/logos/${source.provider.toLowerCase()}.svg`} alt="" width={22} height={22} className="size-full object-contain" />
              </div>
              <div className="min-w-0">
                <h2 id="repository-source-heading" className="sr-only">
                  {t('repository.sourceHeading')}
                </h2>
                <p className="flex min-w-0 items-center gap-1.5">
                  {repoUrl ? (
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-base sm:text-lg font-semibold text-default tracking-tight hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                    >
                      {source.repo}
                    </a>
                  ) : (
                    <span className="truncate text-base sm:text-lg font-semibold text-default tracking-tight">
                      {source.repo}
                    </span>
                  )}
                  {repoUrl ? (
                    <ArrowSquareOut size={13} className="shrink-0 text-muted" aria-hidden="true" />
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted">
                  {PROVIDER_LABEL[source.provider]}
                </p>
              </div>
            </div>

            {batch?.status === 'completed' ? (
              <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 sm:self-auto">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>{t('repository.activeSync')}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/50 text-xs sm:text-sm text-muted">
            <p>{t('repository.sourceDescription')}</p>
            <div className="shrink-0">
              <TestFilePatternsEditor
                projectId={projectId}
                patterns={source.testFilePatterns ?? []}
              />
            </div>
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
          <h2 id="repository-ingestion-heading" className="sr-only">
            {t('repository.ingestionHeading')}
          </h2>

          {/* Stripe-style commit header — compact inline metadata with full-bleed divider */}
          <div className="rule-bleed border-b border-border py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:divide-x divide-border">
              <div className="flex items-center gap-2 sm:pr-5">
                <span className="text-xs font-medium text-muted">{t('repository.branch')}</span>
                {repoUrl ? (
                  <a
                    href={`${repoUrl}/tree/${batch.branch ?? 'main'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-default font-mono hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                  >
                    <Image src="/git.png" alt="" width={14} height={14} className="size-3.5 object-contain" />
                    <span>{batch.branch ?? 'main'}</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-default font-mono">
                    <Image src="/git.png" alt="" width={14} height={14} className="size-3.5 object-contain" />
                    <span>{batch.branch ?? 'main'}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:px-5">
                <span className="text-xs font-medium text-muted">{t('repository.ingestionStatus')}</span>
                <span className="text-xs font-semibold text-default">{t(`repository.status${batch.status === 'completed' ? 'Completed' : batch.status === 'pending' ? 'Pending' : 'Failed'}`)}</span>
              </div>
              <div className="flex items-center gap-2 sm:px-5">
                <span className="text-xs font-medium text-muted">{t('repository.ingestionCreated')}</span>
                <span className="text-xs font-medium text-default">{formatTimestamp(batch.createdAt, locale)}</span>
              </div>
              <div className="flex items-center gap-2 sm:pl-5">
                <span className="text-xs font-medium text-muted">{t('repository.commit')}</span>
                {commitSha ? (
                  commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs font-medium text-default hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                    >
                      {commitSha.slice(0, 7)}
                      <ArrowSquareOut size={11} aria-hidden="true" className="shrink-0" />
                    </a>
                  ) : (
                    <span className="font-mono text-xs font-medium text-default">
                      {commitSha.slice(0, 7)}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </div>
            </div>
          </div>

          {batch.status === 'failed' ? (
            <StateView
              kind="error"
              title={t('repository.ingestionErrorTitle')}
              description={t('repository.ingestionErrorDescription')}
            />
          ) : changedFiles.length > 0 ? (
            <section
              className="space-y-4"
              aria-labelledby="repository-changed-files-heading"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 id="repository-changed-files-heading" className="text-base font-semibold text-default">
                    {t('repository.changedFilesHeading')}
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-muted">
                    {t('repository.changedFilesSummary', {
                      files: changedFiles.length,
                      tests: detectedCount,
                    })}
                  </p>
                </div>

                {detectedCount > 0 && (
                  <SegmentedControl
                    className="flex-wrap"
                    label={t('repository.detectedPattern')}
                    options={[
                      { value: 'all', label: t('repository.filterAll') },
                      ...(source?.testFilePatterns ?? []).map((pattern) => ({
                        value: pattern,
                        label: <span className="font-mono">{pattern}</span>,
                      })),
                    ]}
                    value={patternFilter}
                    onChange={setPatternFilter}
                  />
                )}
              </div>

              {detectedCount === 0 && (
                <div className="rounded-lg border border-border/60 bg-surface/50 px-4 py-3 space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-default">
                    {t('repository.noTestsTitle')}
                  </p>
                  <p className="text-xs text-muted">
                    {t('repository.noTestsDescription', {
                      patterns: (source?.testFilePatterns ?? []).join(', '),
                    })}
                  </p>
                </div>
              )}

              <div className="rule-bleed border-t border-border">
                <EntityList className="divide-y divide-border">
                  {visibleFiles.map((item) => (
                    <ChangedFileItem
                      key={item.change.id}
                      change={item.change}
                      detectedPattern={item.detectedPattern}
                      originEvidence={evidenceById.get(item.change.evidenceId)}
                      projectId={projectId}
                    />
                  ))}
                </EntityList>
              </div>
            </section>
          ) : null}
        </section>
      ) : source ? (
        <StateView
          kind="empty"
          title={t('repository.emptyBatchTitle')}
          description={t('repository.emptyBatchDescription', {
            provider: PROVIDER_LABEL[source.provider],
          })}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setSetupOpen(true)}>
              {t('repository.viewWebhookSetup')}
            </Button>
          }
          className="rounded-lg border border-dashed border-border bg-surface/50 p-8 sm:p-12 text-center"
        />
      ) : null}

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('webhookSetup.heading')}</DialogTitle>
            <DialogDescription>{t('webhookSetup.introManage')}</DialogDescription>
          </DialogHeader>

          {source ? <WebhookSetupPanel provider={source.provider} /> : null}

          <DialogFooter>
            <Button type="button" onClick={() => setSetupOpen(false)}>
              {t('repository.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, Star, ArrowLeft, DotsThreeVertical, PencilSimple, Trash, Plus } from '@phosphor-icons/react'
import type { Suite, TestCase } from '@qably/types'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'
import { useProject } from '@/features/projects/hooks/use-project'
import {
  useConfirmDocumentation,
  useDeleteCase,
  useDeleteSuite,
  useDocumentSuite,
} from '@/features/projects/suites/hooks/use-suite-mutations'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'
import { StatusChip } from '@/components/ui/status-chip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { projectRootPath, projectSuitesPath } from '../../lib/routes'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { Sparkline } from './sparkline'
import { CaseCard } from './case-card'
import { SuiteFormDialog } from './suite-form-dialog'
import { CaseFormDialog } from './case-form-dialog'
import { useSuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import { CASE_HEALTH_SIGNAL_ORDER } from '@/features/projects/suites/lib/case-health-presentation'
import { HealthSignalChip } from './health-signal-chip'
import { DocumentWithAeris, DocumentFilesStatus, useDocumentFiles } from './document-with-aeris'
import { ConfirmDocumentation, useConfirmDocumentationState } from './confirm-documentation'
import { casesAwaitingConfirmation } from '@/features/projects/suites/lib/confirmable-cases'
import { useDocumentationWatch } from '@/features/projects/suites/hooks/use-documentation-watch'
import type { DocumentFilesMode } from './document-with-aeris'

function watchedCount(
  suite: Suite | undefined,
  mode: DocumentFilesMode,
): number | undefined {
  if (suite === undefined) return undefined
  return mode === 'stale-locale' ? suite.staleLocaleCount : suite.undocumentedCount
}

export function SuiteDetail({ projectId, suiteId }: { projectId: string; suiteId: string }) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [watchedMode, setWatchedMode] = useState<DocumentFilesMode>('undocumented')
  const watch = useDocumentationWatch()
  const { suite, isLoading } = useSuite(suiteId, (current) =>
    watch.intervalFor(watchedCount(current, watchedMode)),
  )
  const removeSuite = useDeleteSuite()
  const removeCase = useDeleteCase()
  const documentSuite = useDocumentSuite()
  const documentation = useDocumentFiles(async (mode) => {
    const baseline = watchedCount(suite, mode) ?? 0
    const result = await documentSuite.mutateAsync({ suiteId: suiteId, mode })

    if (result.casesTargeted > 0) {
      setWatchedMode(mode)
      watch.begin(baseline)
    }

    return result
  })
  const confirmDocumentation = useConfirmDocumentation()
  const confirmation = useConfirmDocumentationState(() =>
    confirmDocumentation.mutateAsync({ suiteId, projectId }),
  )
  const { project } = useProject(projectId)
  const { perSuite } = useSuiteMetrics(projectId)
  const metrics = perSuite.find((m) => m.suite.id === suiteId)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [caseDialogOpen, setCaseDialogOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<TestCase | undefined>(undefined)
  const [deletingCase, setDeletingCase] = useState<TestCase | undefined>(undefined)

  function handleEditCase(tc: TestCase) {
    setEditingCase(tc)
    setCaseDialogOpen(true)
  }

  function handleAddCase() {
    setEditingCase(undefined)
    setCaseDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
        <StateView kind="loading" title={t('suites.loading')} />
      </div>
    )
  }

  if (!suite) {
    return (
      <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
        <Breadcrumbs
          items={[
            { label: t('suites.breadcrumbProjects'), href: '/projects' },
            ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
            { label: t('common.notFound') },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-muted">{t('suites.suiteNotFound')}</p>
          <Link
            href={projectRootPath(projectId)}
            className="text-sm text-primary font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden="true" />
            {t('suites.backToProject')}
          </Link>
        </div>
      </div>
    )
  }

  const pendingDocCount = suite.undocumentedCount
  const awaitingConfirmation = casesAwaitingConfirmation(suite.cases).length
  const currentWatchedCount = watchedCount(suite, watchedMode)
  const watchStatus = watch.statusFor(currentWatchedCount)
  const isFullyAutomated = suite.manualCases === 0 && suite.cases.length > 0
  const cannotRunEmptySuite = suite.manualCases === 0 && suite.cases.length === 0

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('suites.breadcrumbSuites'), href: projectSuitesPath(projectId) },
          { label: suite.name },
        ]}
      />

      {/* Hero */}
      <header className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-default text-wrap-balance">
                {suite.name}
              </h1>
              {suite.isDefault && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-warn bg-warn-bg border border-warn/20 rounded px-2 py-0.5"
                  title={t('suites.defaultSuiteTooltip')}
                >
                  <Star size={12} weight="fill" aria-hidden="true" />
                  {t('suites.defaultBadge')}
                </span>
              )}
            </div>
            {suite.description && (
              <p className="text-sm text-muted max-w-[65ch] text-wrap-pretty">
                {suite.description}
              </p>
            )}
            {suite.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {suite.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              {suite.manualCases > 0 && (
                <Button
                  type="button"
                  onClick={() => router.push(`/projects/${projectId}/runs/new?suite=${suite.id}`)}
                  className="text-sm font-semibold"
                  size="default"
                >
                  <Play size={14} weight="bold" aria-hidden="true" />
                  {t('suites.runThisSuite')}
                </Button>
              )}

              {cannotRunEmptySuite && (
                <Button
                  type="button"
                  disabled
                  focusableWhenDisabled
                  aria-describedby="run-suite-empty-hint"
                  onClick={() => router.push(`/projects/${projectId}/runs/new?suite=${suite.id}`)}
                  className="text-sm font-semibold"
                  size="default"
                >
                  <Play size={14} weight="bold" aria-hidden="true" />
                  {t('suites.runThisSuite')}
                </Button>
              )}

              <DocumentWithAeris
                label={t('suites.documentSuiteWithAeris')}
                pendingCount={pendingDocCount}
                staleCount={suite.staleLocaleCount}
                documentation={documentation}
                primary={isFullyAutomated}
              />

              {/* Suite actions */}
              <Menu>
                <MenuTrigger
                  aria-label={t('suites.suiteActions')}
                  className="size-8 inline-flex items-center justify-center rounded-lg border border-border text-muted hover:text-default hover:bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <DotsThreeVertical size={16} weight="bold" aria-hidden="true" />
                </MenuTrigger>
                <MenuPortal>
                  <MenuPositioner align="end">
                    <MenuContent>
                      <MenuItem onClick={() => setEditOpen(true)}>
                        <PencilSimple size={14} aria-hidden="true" />
                        {t('suites.editSuite')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => setDeleteOpen(true)}
                        className="text-fail data-[highlighted]:bg-fail-bg data-[highlighted]:text-fail"
                      >
                        <Trash size={14} aria-hidden="true" />
                        {t('suites.deleteSuite')}
                      </MenuItem>
                    </MenuContent>
                  </MenuPositioner>
                </MenuPortal>
              </Menu>
            </div>

            <div className="min-h-5 max-w-56 flex flex-col items-end gap-1 text-right">
              {documentation.isError || documentation.data !== undefined || watchStatus !== 'idle' || pendingDocCount > 0 ? (
                <DocumentFilesStatus
                  documentation={documentation}
                  pendingCount={pendingDocCount}
                  watchStatus={watchStatus}
                  documentedCount={watch.documentedCountSince(currentWatchedCount)}
                />
              ) : cannotRunEmptySuite ? (
                <p id="run-suite-empty-hint" className="text-xs text-muted">
                  {t('suites.cannotRunEmptySuite')}
                </p>
              ) : isFullyAutomated ? (
                <p className="text-xs text-muted">{t('suites.allAutomatedHint')}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Health strip — explains what this suite is doing right now */}
        {metrics && (
          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm border-t border-border pt-4"
            role="group"
            aria-label={t('suites.ariaSuiteHealth')}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">{t('suites.statusLabel')}</span>
              <StatusChip status={metrics.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">{t('suites.passRateLabel')}</span>
              <span
                className={`text-sm font-mono font-semibold tabular-nums ${
                  metrics.recentPassRate >= 70
                    ? 'text-pass'
                    : metrics.recentPassRate > 0
                      ? 'text-warn'
                      : 'text-muted'
                }`}
              >
                {metrics.recentPassRate}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">{t('suites.lastRun')}</span>
              <span className="text-sm font-medium text-default">
                {formatRelative(metrics.lastRun?.startedAt, locale, t('suites.never'))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">{t('suites.casesLabel')}</span>
              <span className="text-sm font-mono font-semibold text-default tabular-nums">
                {suite.cases.length}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <Sparkline
                data={metrics.sparkline.map(({ date, passRate }) => ({ date, passRate }))}
                tone={metrics.recentPassRate >= 70 ? 'pass' : metrics.recentPassRate > 0 ? 'warn' : 'muted'}
                width={80}
                height={24}
              />
            </div>
          </div>
        )}

        {suite.healthSummary && Object.keys(suite.healthSummary).length > 0 && (
          <div
            role="group"
            aria-label={t('quality.signals.stripAriaLabel')}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-4"
          >
            {CASE_HEALTH_SIGNAL_ORDER.filter(
              (signal) => (suite.healthSummary?.[signal] ?? 0) > 0,
            ).map((signal) => (
              <HealthSignalChip key={signal} signal={signal} count={suite.healthSummary?.[signal]} />
            ))}
          </div>
        )}
      </header>

      <ConfirmDocumentation
        pendingCount={awaitingConfirmation}
        confirmation={confirmation}
      />

      {/* Case list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-default">{t('suites.testCases')}</h2>
            <span className="text-xs text-muted">
              {suite.cases.length} {suite.cases.length === 1 ? t('suites.case_one') : t('suites.case_other')}
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddCase}>
            <Plus size={14} weight="bold" aria-hidden="true" />
            {t('suites.addCase')}
          </Button>
        </div>
        <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <CardContent className="p-0 divide-y divide-border">
            {suite.cases.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-muted">{t('suites.noTestCases')}</p>
                <button
                  type="button"
                  onClick={handleAddCase}
                  className="text-sm font-medium text-default hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {t('suites.noCasesCta')}
                </button>
              </div>
            ) : (
              suite.cases.map((tc) => (
                <CaseCard key={tc.id} testCase={tc} projectId={projectId} onEdit={handleEditCase} onDelete={setDeletingCase} />
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Covered by CI */}
      {suite.automatedCases > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-default">{t('suites.coveredByCi')}</h2>
            <span className="text-xs text-muted">{suite.automatedCases}</span>
          </div>
          <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <CardContent className="p-0 divide-y divide-border">
              {suite.cases
                .filter((tc) => tc.executionMode === 'automated')
                .map((tc) => {
                  const described = describeCase(tc)
                  return (
                    <div
                      key={tc.id}
                      className="py-3 px-4 sm:px-5 flex items-center gap-3 flex-wrap"
                    >
                      <span className="text-sm font-medium text-default truncate flex-1 min-w-[200px]">
                        {described.title}
                      </span>
                      {tc.lastResult ? (
                        <div className="flex items-center gap-2" aria-label={t('suites.lastResult')}>
                          <StatusChip status={tc.lastResult.status} />
                          <span className="text-xs text-muted">
                            {formatRelative(tc.lastResult.recordedAt, locale, t('suites.never'))}
                          </span>
                          {tc.lastResult.commitSha && (
                            <Link
                              href={`/projects/${projectId}/runs/${tc.lastResult.runId}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {tc.lastResult.commitSha.slice(0, 7)}
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">{t('suites.never')}</span>
                      )}
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Suite dialogs */}
      <SuiteFormDialog
        projectId={projectId}
        suite={suite}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('suites.deleteSuiteTitle')}
        description={t('suites.deleteSuiteDescription', {
          name: suite.name,
          count: suite.cases.length,
        })}
        onConfirm={() => {
          removeSuite.mutate(suite.id, {
            onSuccess: () => router.push(projectSuitesPath(projectId)),
          })
        }}
      />

      {/* Case dialogs */}
      <CaseFormDialog
        suiteId={suite.id}
        testCase={editingCase}
        open={caseDialogOpen}
        onOpenChange={setCaseDialogOpen}
      />
      <ConfirmDialog
        open={deletingCase !== undefined}
        onOpenChange={(open) => { if (!open) setDeletingCase(undefined) }}
        title={t('suites.deleteCaseTitle')}
        description={t('suites.deleteCaseDescription', { name: deletingCase?.name ?? '' })}
        onConfirm={() => {
          if (deletingCase) {
            removeCase.mutate({ suiteId: suite.id, caseId: deletingCase.id })
          }
        }}
      />
    </div>
  )
}

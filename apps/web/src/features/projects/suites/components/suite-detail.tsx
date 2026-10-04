'use client'

import { useEffect, useState } from 'react'
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
  useRefreshSuiteLists,
} from '@/features/projects/suites/hooks/use-suite-mutations'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { BackButton } from '@/components/ui/back-button'
import { EntityList } from '@/components/ui/entity-list'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  projectAerisPath,
  projectRootPath,
  projectSuitesPath,
  suiteEditPath,
  suiteEditNewCasePath,
  suiteEditCasePath,
} from '../../lib/routes'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { CaseCard } from './case-card'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { CASE_HEALTH_SIGNAL_ORDER } from '@/features/projects/suites/lib/case-health-presentation'
import { groupCasesForDisplay } from '@/features/projects/suites/lib/case-groups'
import {
  buildCaseResultOptions,
  matchesCaseResult,
  type CaseResultFilter,
} from '@/features/projects/suites/lib/suite-filter-options'
import { SelectSimple } from '@/components/ui/select'
import { HealthSignalChip } from './health-signal-chip'
import { SuiteCollisionsPanel } from './suite-collisions-panel'
import { DocumentWithAeris, useDocumentFiles } from './document-with-aeris'
import { ConfirmDocumentation, useConfirmDocumentationState } from './confirm-documentation'
import { casesAwaitingConfirmation } from '@/features/projects/suites/lib/confirmable-cases'
import { useDocumentationWatch } from '@/features/projects/suites/hooks/use-documentation-watch'
import { useDocumentationFeedback } from '@/features/projects/suites/hooks/use-documentation-feedback'
import { notify } from '@/lib/notify'
import type { DocumentFilesMode } from './document-with-aeris'
import { isDocumentationBusy, isOutcomeIncomplete } from '@/features/projects/suites/lib/documentation-state'

function incompleteUnitsCount(suite: Suite): number {
  return suite.incompleteCount + (isOutcomeIncomplete(suite.documentation) ? 1 : 0)
}

function watchedCount(
  suite: Suite | undefined,
  mode: DocumentFilesMode,
): number | undefined {
  if (suite === undefined) return undefined
  if (mode === 'stale-locale') return suite.staleLocaleCount
  if (mode === 'incomplete') return incompleteUnitsCount(suite)
  return suite.undocumentedCount
}

export function SuiteDetail({ projectId, suiteId }: { projectId: string; suiteId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [watchedMode, setWatchedMode] = useState<DocumentFilesMode>('undocumented')
  const watch = useDocumentationWatch()
  const { observe } = watch
  const { suite, isLoading, dataUpdatedAt } = useSuite(suiteId, (current) =>
    watch.intervalFor(isDocumentationBusy(current)),
  )

  useEffect(() => {
    if (dataUpdatedAt === 0) return
    observe(isDocumentationBusy(suite))
  }, [dataUpdatedAt, suite, observe])
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
  const confirmation = useConfirmDocumentationState(async (caseIds: string[]) => {
    try {
      const outcome = await confirmDocumentation.mutateAsync({ suiteId, projectId, caseIds })
      notify.success(t('suites.confirmDocumentationDone', { count: outcome.confirmedCount }), {
        description:
          outcome.skippedCount > 0
            ? t('suites.confirmDocumentationSkipped', { count: outcome.skippedCount })
            : undefined,
      })
      return outcome
    } catch (error) {
      notify.error(t('suites.confirmDocumentationError'))
      throw error
    }
  })
  const { project } = useProject(projectId)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingCase, setDeletingCase] = useState<TestCase | undefined>(undefined)
  const [resultFilter, setResultFilter] = useState<CaseResultFilter>('all')

  const currentWatchedCount = watchedCount(suite, watchedMode)
  const watchStatus = watch.statusFor(isDocumentationBusy(suite))
  const documentedCount = watch.documentedCountSince(currentWatchedCount)

  useDocumentationFeedback({ documentation, watchStatus, documentedCount })

  const refreshSuiteLists = useRefreshSuiteLists()

  useEffect(() => {
    if (watchStatus !== 'settled') return
    void refreshSuiteLists(projectId, suiteId)
  }, [watchStatus, projectId, suiteId, refreshSuiteLists])

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
          className="hidden md:flex"
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
  const hasUndocumented = pendingDocCount > 0
  const primaryMode: DocumentFilesMode = hasUndocumented ? 'undocumented' : 'incomplete'
  const primaryCount = hasUndocumented ? pendingDocCount : incompleteUnitsCount(suite)
  const primaryLabel = hasUndocumented
    ? t('suites.documentSuiteWithAeris', { count: pendingDocCount })
    : t('suites.completeSuiteWithAeris', { count: primaryCount })
  const awaitingCases = casesAwaitingConfirmation(suite.cases)
  const visibleCases = suite.cases.filter((tc) => matchesCaseResult(tc, resultFilter))
  const caseGroups = groupCasesForDisplay(visibleCases)
  const orderedCases = caseGroups ? caseGroups.flatMap((group) => group.cases) : visibleCases
  const isFullyAutomated = suite.manualCases === 0 && suite.cases.length > 0
  const cannotRunEmptySuite = suite.manualCases === 0 && suite.cases.length === 0

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <div className="flex min-w-0 items-center gap-1.5">
        <BackButton
          onClick={() => {
            if (window.history.length > 1) {
              router.back()
            } else {
              router.push(projectSuitesPath(projectId))
            }
          }}
        />
        <Breadcrumbs
          className="hidden md:flex"
          items={[
            { label: t('suites.breadcrumbProjects'), href: '/projects' },
            ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
            { label: t('suites.breadcrumbSuites'), href: projectSuitesPath(projectId) },
            { label: suite.name },
          ]}
        />
      </div>

      {/* Hero */}
      <header className="rule-bleed space-y-4 border-b border-border pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
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

          {/* Suite actions — pinned top-right regardless of how the title wraps */}
          <Menu>
            <MenuTrigger
              aria-label={t('suites.suiteActions')}
              className="size-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-border text-muted hover:text-default hover:bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              <DotsThreeVertical size={16} weight="bold" aria-hidden="true" />
            </MenuTrigger>
            <MenuPortal>
              <MenuPositioner align="end">
                <MenuContent>
                  <MenuItem onClick={() => router.push(suiteEditPath(projectId, suite.id))}>
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

        <div className="flex flex-wrap items-center gap-2">
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
            label={primaryLabel}
            pendingCount={primaryCount}
            primaryMode={primaryMode}
            staleCount={suite.staleLocaleCount}
            documentation={documentation}
            primary={isFullyAutomated}
            activeMode={watchStatus === 'working' ? watchedMode : undefined}
          />

          <ConfirmDocumentation cases={awaitingCases} confirmation={confirmation} />
        </div>

        {cannotRunEmptySuite && (
          <p id="run-suite-empty-hint" className="text-xs text-muted">
            {t('suites.cannotRunEmptySuite')}
          </p>
        )}

        {suite.healthSummary && Object.keys(suite.healthSummary).length > 0 && (
          <div
            role="group"
            aria-label={t('quality.signals.stripAriaLabel')}
            className="rule-bleed flex flex-wrap items-center gap-2 border-t border-border pt-4"
          >
            {CASE_HEALTH_SIGNAL_ORDER.filter(
              (signal) => (suite.healthSummary?.[signal] ?? 0) > 0,
            ).map((signal) => (
              <HealthSignalChip key={signal} signal={signal} count={suite.healthSummary?.[signal]} />
            ))}
          </div>
        )}

        <SuiteCollisionsPanel openCollisions={suite.openCollisions} />
      </header>

      {/* Case list */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-default">
            {t('suites.testCasesCount', { count: suite.cases.length })}
          </h2>
          <div className="flex items-center gap-2">
            <SelectSimple
              options={buildCaseResultOptions(t)}
              value={resultFilter}
              onValueChange={(value) => setResultFilter(value as CaseResultFilter)}
              triggerClassName="h-8 w-auto"
            />
            <Link
              href={suiteEditNewCasePath(projectId, suite.id)}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              {t('suites.addCase')}
            </Link>
          </div>
        </div>
        {suite.cases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/50 py-12 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted">{t('suites.noTestCases')}</p>
            <Link
              href={suiteEditNewCasePath(projectId, suite.id)}
              className="text-sm font-medium text-default hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('suites.noCasesCta')}
            </Link>
          </div>
        ) : orderedCases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/50 py-12 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted">{t('suites.noCasesMatch')}</p>
            <button
              type="button"
              onClick={() => setResultFilter('all')}
              className="text-sm font-medium text-default hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('common.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="rule-bleed border-t border-border">
            <EntityList>
              {orderedCases.map((tc) => (
                <li key={tc.id}>
                  <CaseCard
                    testCase={tc}
                    projectId={projectId}
                    githubRepo={project?.githubRepo}
                    onEdit={(edited) => router.push(suiteEditCasePath(projectId, suite.id, edited.id))}
                    onDelete={setDeletingCase}
                    onImproveWithAeris={(improved) =>
                      router.push(`${projectAerisPath(projectId)}?case=${improved.id}`)
                    }
                  />
                </li>
              ))}
            </EntityList>
          </div>
        )}
      </section>

      {/* Suite dialogs */}
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

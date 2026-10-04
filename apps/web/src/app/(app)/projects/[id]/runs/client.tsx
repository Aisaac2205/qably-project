'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from '@phosphor-icons/react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { CiRunList } from '@/features/runs/components/ci-run-list'
import { RunList } from '@/features/runs/components/run-list'
import { DEFAULT_RUNS_TAB, parseRunsTab, type RunsTab } from '@/features/runs/lib/runs-tab'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/features/projects/hooks/use-project'
import { cn } from '@/lib/utils'
import { projectRootPath } from '@/features/projects/lib/routes'

export function RunListPageClient({
  projectId,
  initialTab = DEFAULT_RUNS_TAB,
}: {
  projectId: string
  initialTab?: RunsTab
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { project } = useProject(projectId)
  const hasNoManualCases = project?.hasManualCases === false
  const [tab, setTab] = useState(initialTab)
  const [urlTab, setUrlTab] = useState(initialTab)

  if (urlTab !== initialTab) {
    setUrlTab(initialTab)
    setTab(initialTab)
  }

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('runs.title') },
        ]}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">{t('runs.title')}</h1>
          <p className="text-sm text-muted">{t('runs.subtitle')}</p>
        </div>
        {hasNoManualCases ? (
          <div className="flex flex-col md:items-end gap-1 w-full md:w-auto">
            <Button
              type="button"
              disabled
              focusableWhenDisabled
              aria-describedby="new-run-no-manual-hint"
              className="w-full md:w-auto"
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              {t('runs.newRun')}
            </Button>
            <p id="new-run-no-manual-hint" className="text-xs text-muted max-w-[260px] text-left md:text-right">
              {t('runs.noManualCasesInProject')}
            </p>
          </div>
        ) : (
          <Link
            href={`/projects/${projectId}/runs/new`}
            className={cn(buttonVariants(), 'w-full md:w-auto')}
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            {t('runs.newRun')}
          </Link>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value, eventDetails) => {
          if (eventDetails.reason !== 'none') return

          const next = parseRunsTab(value)
          setTab(next)
          router.replace(`/projects/${projectId}/runs?tab=${next}`, { scroll: false })
        }}
        className="gap-4"
      >
        <TabsList aria-label={t('runs.ci.tabsAria')}>
          <TabsTab value="actions">{t('runs.ci.tabActions')}</TabsTab>
          <TabsTab value="manual">{t('runs.ci.tabManual')}</TabsTab>
        </TabsList>
        <TabsPanel value="actions" tabIndex={-1}>
          <CiRunList projectId={projectId} />
        </TabsPanel>
        <TabsPanel value="manual" tabIndex={-1}>
          <RunList projectId={projectId} ungrouped />
        </TabsPanel>
      </Tabs>
    </div>
  )
}

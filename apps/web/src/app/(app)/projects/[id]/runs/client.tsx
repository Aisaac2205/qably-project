'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { CiRunList } from '@/features/runs/components/ci-run-list'
import { NewRunAction } from '@/features/runs/components/new-run-action'
import { RunList } from '@/features/runs/components/run-list'
import { DEFAULT_RUNS_TAB, parseRunsTab, type RunsTab } from '@/features/runs/lib/runs-tab'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/features/projects/hooks/use-project'
import { projectRootPath } from '@/features/projects/lib/routes'

export function RunListPageClient({
  projectId,
  initialTab = DEFAULT_RUNS_TAB,
  openNewRun = false,
  initialSuiteId,
}: {
  projectId: string
  initialTab?: RunsTab
  openNewRun?: boolean
  initialSuiteId?: string
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

      <h1 className="sr-only">{t('runs.title')}</h1>

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
        <TabsPanel value="manual" tabIndex={-1} className="space-y-4">
          <NewRunAction
            projectId={projectId}
            disabled={hasNoManualCases}
            defaultOpen={openNewRun}
            initialSuiteId={initialSuiteId}
          />
          <RunList projectId={projectId} ungrouped hasManualCases={project?.hasManualCases} />
        </TabsPanel>
      </Tabs>
    </div>
  )
}

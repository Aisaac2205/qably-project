'use client'

import { useId, useState } from 'react'
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

const ACTION_FOCUS =
  'focus-visible:outline-hidden! focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

function NewRunAction({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { t } = useTranslation()
  const hintId = useId()

  if (disabled) {
    return (
      <div className="flex flex-col gap-1 md:items-end">
        <Button
          type="button"
          disabled
          focusableWhenDisabled
          aria-describedby={hintId}
          className={cn('w-full md:w-auto', ACTION_FOCUS)}
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
          {t('runs.newRun')}
        </Button>
        <p id={hintId} className="text-xs text-muted md:max-w-64 md:text-right">
          {t('runs.noManualCasesInProject')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex md:justify-end">
      <Link
        href={`/projects/${projectId}/runs/new`}
        className={cn(buttonVariants(), 'w-full md:w-auto', ACTION_FOCUS)}
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
        {t('runs.newRun')}
      </Link>
    </div>
  )
}

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
          <NewRunAction projectId={projectId} disabled={hasNoManualCases} />
          <RunList projectId={projectId} ungrouped />
        </TabsPanel>
      </Tabs>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { DashboardPeriod } from '@qably/types'
import { DASHBOARD_PERIODS } from '@qably/types'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { PageHeader } from '@/components/ui/page-header'
import AnimatedDropdown from '@/components/ui/animated-dropdown'
import { KpiStrip } from '@/features/dashboard/components/kpi-strip'
import { useProject } from '@/features/projects/hooks/use-project'
import { projectRootPath } from '@/features/projects/lib/routes'
import { useTranslation } from '@/lib/i18n'
import { PassRateDeltaTrend } from './pass-rate-delta-trend'
import { DailyActivityBarChart } from './daily-activity-bar-chart'

const SHELL_CLASSES =
  'mx-auto w-full max-w-dashboard space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter'

export function QualityPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<DashboardPeriod>(30)
  const { project } = useProject(projectId)

  return (
    <div className={SHELL_CLASSES}>
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('quality.breadcrumb') },
        ]}
      />

      <PageHeader
        title={project?.name ?? t('quality.breadcrumb')}
        actions={
          <AnimatedDropdown
            align="right"
            aria-label={t('dashboard.periodLabel')}
            text={t(`dashboard.period${period}d`)}
            items={DASHBOARD_PERIODS.map((value) => ({
              name: t(`dashboard.period${value}d`),
              value,
              active: period === value,
              onClick: () => setPeriod(value),
            }))}
          />
        }
      />

      <KpiStrip period={period} projectId={projectId} />

      <section
        aria-labelledby="quality-trend-heading"
        className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="quality-trend-heading" className="sr-only">
          {t('quality.trendHeading')}
        </h2>
        <PassRateDeltaTrend projectId={projectId} days={period} />
      </section>

      <DailyActivityBarChart projectId={projectId} period={period} />
    </div>
  )
}

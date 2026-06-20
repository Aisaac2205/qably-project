'use client'

import { KpiRow } from './kpi-row'
import { ProjectHealthCard } from './project-health-card'
import { RecentActivity } from './recent-activity'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useOrg } from '@/lib/use-mock-store'

export function DashboardPage() {
  const stats = useDashboardStats()
  const org = useOrg()

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-default">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {org.name}
        </p>
      </div>

      <KpiRow />

      <section>
        <h2 className="text-lg font-medium mb-3">Project health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.projectsByHealth.map(({ project }) => (
            <ProjectHealthCard
              key={project.id}
              project={project}
              lastRunStatus={project.lastRunStatus}
              lastRunAt={project.lastRunAt}
              suiteCount={project.suiteCount}
              aiPendingCount={project.aiPendingCount}
            />
          ))}
        </div>
      </section>

      <RecentActivity />
    </div>
  )
}

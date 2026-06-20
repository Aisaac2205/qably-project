import { KpiCard } from '@/components/dashboard/kpi-card'
import { ProjectHealthCard } from '@/components/dashboard/project-health-card'
import { mockProjects } from '@/lib/mock-data'

const totalRuns = 24
const passRate = 91
const failingCount = 3
const aiPending = mockProjects.reduce((sum, p) => sum + p.aiPendingCount, 0)

export default function DashboardPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard value={totalRuns} label="Runs today" />
        <KpiCard value={`${passRate}%`} label="Pass rate" colorVariant="pass" />
        <KpiCard value={failingCount} label="Failing" colorVariant={failingCount > 0 ? 'fail' : 'neutral'} />
        <KpiCard value={aiPending} label="AI pending" colorVariant={aiPending > 0 ? 'ai' : 'neutral'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {mockProjects.map(project => (
          <ProjectHealthCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}

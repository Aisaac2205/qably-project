'use client'

import dynamic from 'next/dynamic'
import { useProjectContext } from '@/features/projects/context/project-context'
import { useRuns, useAiCases } from '@/lib/use-mock-store'

const PassRateChart = dynamic(
  () => import('./pass-rate-chart').then((mod) => mod.PassRateChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
)

const DistributionChart = dynamic(
  () => import('./distribution-chart').then((mod) => mod.DistributionChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
)

const AiCasesChart = dynamic(
  () => import('./ai-cases-chart').then((mod) => mod.AiCasesChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
)

function ChartSkeleton() {
  return (
    <div className="h-64 rounded-md border border-border p-4 bg-surface animate-pulse">
      <div className="h-4 w-1/3 bg-muted/30 rounded mb-4" />
      <div className="h-40 bg-muted/20 rounded" />
    </div>
  )
}

export function ReportsPage() {
  const { projectId } = useProjectContext()
  const runs = useRuns(projectId)
  const aiCases = useAiCases(projectId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold text-default" id="reports-heading">
        Reports
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pass Rate Chart */}
        <div className="rounded-md border border-border p-4 bg-surface">
          <h2 className="text-sm font-medium text-default mb-3">Pass Rate Over Time</h2>
          <PassRateChart runs={runs} />
        </div>

        {/* Distribution Chart */}
        <div className="rounded-md border border-border p-4 bg-surface">
          <h2 className="text-sm font-medium text-default mb-3">Pass / Fail Distribution</h2>
          <DistributionChart runs={runs} />
        </div>

        {/* AI Cases Chart */}
        <div className="rounded-md border border-border p-4 bg-surface lg:col-span-2">
          <h2 className="text-sm font-medium text-default mb-3">AI Case Review Status</h2>
          <AiCasesChart aiCases={aiCases} />
        </div>
      </div>
    </div>
  )
}

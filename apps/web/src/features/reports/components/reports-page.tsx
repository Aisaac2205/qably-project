'use client'

import dynamic from 'next/dynamic'
import { useProjectContext } from '@/features/projects/context/project-context'
import { useRuns, useAiCases } from '@/lib/use-mock-store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="h-4 w-1/3 bg-muted/30 rounded mb-4" />
        <div className="h-40 bg-muted/20 rounded" />
      </CardContent>
    </Card>
  )
}

export function ReportsPage() {
  const { projectId } = useProjectContext()
  const runs = useRuns(projectId)
  const aiCases = useAiCases(projectId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-default" id="reports-heading">
        Reports
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pass Rate Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pass Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <PassRateChart runs={runs} />
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pass / Fail Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionChart runs={runs} />
          </CardContent>
        </Card>

        {/* AI Cases Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI Case Review Status</CardTitle>
          </CardHeader>
          <CardContent>
            <AiCasesChart aiCases={aiCases} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

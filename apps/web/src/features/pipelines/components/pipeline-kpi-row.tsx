'use client'

import { useMemo } from 'react'
import { Play, CircleNotch, XCircle, CheckCircle } from '@phosphor-icons/react'
import { KpiCard } from '@/components/ui/kpi-card'
import { usePipelines } from '@/lib/use-mock-store'

export function PipelineKpiRow({ projectId }: { projectId: string }) {
  const pipelines = usePipelines(projectId)

  const stats = useMemo(() => {
    const total = pipelines.length
    const running = pipelines.filter((p) => p.status === 'running').length
    const failed = pipelines.filter((p) => p.status === 'fail').length
    const completed = pipelines.filter((p) => p.status === 'pass').length
    const runningPct = total > 0 ? Math.round((running / total) * 100) : 0
    const failedPct = total > 0 ? Math.round((failed / total) * 100) : 0
    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, running, failed, completed, runningPct, failedPct, completedPct }
  }, [pipelines])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Total runs"
        value={stats.total}
        icon={Play}
        accent="primary"
        subtext="All pipeline runs"
      />
      <KpiCard
        label="Running"
        value={stats.running}
        icon={CircleNotch}
        accent="running"
        subtext={stats.total > 0 ? `${stats.runningPct}% of total` : undefined}
      />
      <KpiCard
        label="Failed"
        value={stats.failed}
        icon={XCircle}
        accent="fail"
        subtext={stats.total > 0 ? `${stats.failedPct}% of total` : undefined}
      />
      <KpiCard
        label="Completed"
        value={stats.completed}
        icon={CheckCircle}
        accent="pass"
        subtext={stats.total > 0 ? `${stats.completedPct}% of total` : undefined}
      />
    </div>
  )
}

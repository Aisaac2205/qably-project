'use client'

import { PipelineList } from '@/features/pipelines/components/pipeline-list'
import { PipelineKpiRow } from '@/features/pipelines/components/pipeline-kpi-row'
import { useProjectContext } from '@/features/projects/context/project-context'
import { Button } from '@/components/ui/button'
import { Plus, Gear } from '@phosphor-icons/react'

export default function PipelinesPage() {
  const { projectId } = useProjectContext()
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-default">Pipelines</h1>
          <p className="text-sm text-muted mt-0.5">Real-time status of your GitHub Actions workflows</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted hover:text-default">
            <Gear size={14} aria-hidden="true" />
            View settings
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus size={14} weight="bold" aria-hidden="true" />
            New pipeline
          </Button>
        </div>
      </div>

      <PipelineKpiRow projectId={projectId} />

      <PipelineList projectId={projectId} />
    </div>
  )
}

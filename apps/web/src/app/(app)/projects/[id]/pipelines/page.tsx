'use client'

import { PipelineList } from '@/features/pipelines/components/pipeline-list'
import { useProjectContext } from '@/features/projects/context/project-context'

export default function PipelinesPage() {
  const { projectId } = useProjectContext()
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-default">Pipelines</h1>
      </div>
      <PipelineList projectId={projectId} />
    </div>
  )
}

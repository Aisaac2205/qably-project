'use client'

import { RunList } from '@/features/runs/components/run-list'
import { useProjectContext } from '@/features/projects/context/project-context'

export default function PipelinesPage() {
  const { projectId } = useProjectContext()
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-default">Pipelines</h1>
        <p className="text-sm text-muted mt-0.5">Runs from CI (GitHub Actions)</p>
      </div>
      <RunList projectId={projectId} source="github_actions" />
    </div>
  )
}

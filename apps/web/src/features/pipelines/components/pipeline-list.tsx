'use client'

import { useState, useMemo, useCallback } from 'react'
import type { PipelineStatus } from '@qably/types'
import { usePipelines } from '@/lib/use-mock-store'
import { Card, CardContent } from '@/components/ui/card'
import { PipelineFilter } from './pipeline-filter'
import { PipelineRow } from './pipeline-row'

const ALL_VALUES: PipelineStatus[] = ['pass', 'fail', 'running', 'pending', 'cancelled']

export function PipelineList({ projectId }: { projectId: string }) {
  const pipelines = usePipelines(projectId)
  const [selected, setSelected] = useState<Set<PipelineStatus>>(new Set(ALL_VALUES))

  const filtered = useMemo(() => {
    return pipelines
      .filter((p) => selected.has(p.status))
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
  }, [pipelines, selected])

  if (pipelines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted py-16">
        No pipeline runs yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <PipelineFilter selected={selected} onChange={setSelected} />

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center text-[11px] text-muted py-8">
          No pipelines match the selected filters
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {filtered.map((p) => (
              <PipelineRow key={p.id} p={p} projectId={projectId} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

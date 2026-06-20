'use client'

import { useRouter } from 'next/navigation'
import { useSuite, useProject } from '@/lib/use-mock-store'
import { Card, CardContent } from '@/components/ui/card'
import { CaseCard } from './case-card'
import { Play } from '@phosphor-icons/react'

export function SuiteDetail({ projectId, suiteId }: { projectId: string; suiteId: string }) {
  const suite = useSuite(suiteId)
  const project = useProject(projectId)
  const router = useRouter()

  if (!suite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted text-sm">Suite not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-default">{suite.name}</h1>
          <p className="text-[11px] text-muted mt-0.5">
            {suite.cases.length} test cases
          </p>
        </div>
        <button
          onClick={() => router.push(`/projects/${projectId}/runs/new?suite=${suite.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          type="button"
        >
          <Play size={14} weight="bold" aria-hidden="true" />
          Run this suite
        </button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {suite.cases.length === 0 ? (
            <div className="py-8 text-center text-muted text-sm">No test cases in this suite</div>
          ) : (
            suite.cases.map((tc) => (
              <CaseCard key={tc.id} testCase={tc} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

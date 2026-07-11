'use client'

import { useSuites } from '@/lib/use-mock-store'
import { Badge } from '@/components/ui/badge'
import { CopySimple } from '@phosphor-icons/react'

export function DuplicateComparison({
  duplicateOfCaseId,
  similarityScore,
  projectId,
}: {
  duplicateOfCaseId: string
  similarityScore: number
  projectId: string
}) {
  const suites = useSuites(projectId)
  const existingCase = suites.flatMap((s) => s.cases).find((c) => c.id === duplicateOfCaseId)

  return (
    <div className="rounded border border-warn/30 bg-warn-bg p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warn">
        <CopySimple size={14} weight="bold" aria-hidden="true" />
        Possible duplicate
        <Badge variant="warn" className="ml-auto">
          {Math.round(similarityScore * 100)}%
        </Badge>
      </div>
      {existingCase ? (
        <div>
          <p className="text-xs font-medium text-default">{existingCase.name}</p>
          <p className="text-[11px] text-muted mt-0.5">
            This looks similar to an existing case in this project&apos;s suites.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          The original matching case could not be located (it may have been removed).
        </p>
      )}
    </div>
  )
}

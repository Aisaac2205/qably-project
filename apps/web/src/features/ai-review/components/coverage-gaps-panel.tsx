'use client'

import { useState } from 'react'
import { useCoverageGaps } from '@/lib/use-mock-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaretDown, Target } from '@phosphor-icons/react'

const SEVERITY_VARIANT = {
  high: 'fail',
  medium: 'warn',
  low: 'skip',
} as const

export function CoverageGapsPanel({
  projectId,
  onDraftWithAi,
}: {
  projectId: string
  onDraftWithAi: (area: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const gaps = useCoverageGaps(projectId)

  if (gaps.length === 0) return null

  return (
    <div className="border-t border-border bg-surface">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-semibold text-default hover:bg-canvas transition-colors"
      >
        <Target size={14} className="text-ai" aria-hidden="true" />
        Coverage gaps
        <Badge variant="outline">{gaps.length}</Badge>
        <CaretDown
          size={12}
          className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <ul className="divide-y divide-border">
          {gaps.map((gap) => (
            <li key={gap.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-default">{gap.area}</span>
                  <Badge variant={SEVERITY_VARIANT[gap.severity]}>{gap.severity}</Badge>
                </div>
                <p className="text-[11px] text-muted mt-0.5">{gap.description}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onDraftWithAi(gap.area)}>
                Draft with AI
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

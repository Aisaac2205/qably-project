'use client'

import type { RunCase } from '@qably/types'
import { StatusChip } from './status-chip'

export function CaseList({
  cases,
  selectedId,
  onSelect,
}: {
  cases: RunCase[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted p-4">
        No cases in this run
      </div>
    )
  }

  return (
    <div className="divide-y divide-border" role="listbox" aria-label="Run cases">
      {cases.map((c) => {
        const isSelected = c.id === selectedId
        return (
          <button
            key={c.id}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary ${
              isSelected
                ? 'bg-muted/80 border-l-2 border-primary'
                : 'border-l-2 border-transparent'
            }`}
          >
            <div className="shrink-0">
              <StatusChip status={c.status} />
            </div>
            <span className="text-xs text-default truncate">{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}

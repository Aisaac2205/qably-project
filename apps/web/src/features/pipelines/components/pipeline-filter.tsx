'use client'

import type { PipelineStatus } from '@qably/types'

const ALL_STATUSES: Array<{ value: PipelineStatus; label: string; activeClass: string }> = [
  { value: 'running', label: 'Running', activeClass: 'bg-running-bg text-running border-running/30' },
  { value: 'pass',    label: 'Pass',    activeClass: 'bg-pass-bg text-pass border-pass/30' },
  { value: 'fail',    label: 'Fail',    activeClass: 'bg-fail-bg text-fail border-fail/30' },
  { value: 'pending', label: 'Pending', activeClass: 'bg-skip-bg text-muted border-border' },
  { value: 'cancelled', label: 'Cancelled', activeClass: 'bg-skip-bg text-muted border-border' },
]

const ALL_VALUES = ALL_STATUSES.map((s) => s.value)

const INACTIVE_CLASS = 'border-border text-muted bg-transparent hover:bg-canvas hover:text-default'
const ALL_ACTIVE_CLASS = 'bg-primary/10 text-primary border-primary/30'

export function PipelineFilter({
  selected,
  onChange,
}: {
  selected: Set<PipelineStatus>
  onChange: (next: Set<PipelineStatus>) => void
}) {
  const allSelected = ALL_VALUES.every((v) => selected.has(v))

  function toggle(status: PipelineStatus) {
    const next = new Set(selected)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    onChange(next)
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(ALL_VALUES))
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
      <button
        onClick={toggleAll}
        aria-label="All"
        aria-pressed={allSelected}
        className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
          allSelected ? ALL_ACTIVE_CLASS : INACTIVE_CLASS
        }`}
      >
        All
      </button>

      {ALL_STATUSES.map((s) => {
        const active = selected.has(s.value)
        return (
          <button
            key={s.value}
            onClick={() => toggle(s.value)}
            aria-label={s.label}
            aria-pressed={active}
            className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
              active ? s.activeClass : INACTIVE_CLASS
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

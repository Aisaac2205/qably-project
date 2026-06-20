'use client'

import type { PipelineStatus } from '@qably/types'

const ALL_STATUSES: Array<{ value: PipelineStatus; label: string }> = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'running', label: 'Running' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]

const ALL_VALUES = ALL_STATUSES.map((s) => s.value)

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
    if (allSelected) {
      onChange(new Set())
    } else {
      onChange(new Set(ALL_VALUES))
    }
  }

  return (
    <div className="space-y-2" aria-label="Filter by status">
      <label className="text-[11px] font-semibold text-default">Status</label>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="size-3 accent-primary cursor-pointer"
          />
          All
        </label>
        {ALL_STATUSES.map((s) => (
          <label
            key={s.value}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={selected.has(s.value)}
              onChange={() => toggle(s.value)}
              className="size-3 accent-primary cursor-pointer"
            />
            {s.label}
          </label>
        ))}
      </div>
    </div>
  )
}

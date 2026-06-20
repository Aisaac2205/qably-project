'use client'

import type { RunCase } from '@qably/types'
import { StatusChip } from './status-chip'

export function CaseDetail({ c }: { c: RunCase }) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-default">{c.name}</h3>
        <StatusChip status={c.status} />
      </div>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
          Steps
        </h4>
        <ol className="space-y-1 list-decimal list-inside">
          {c.steps.map((step, i) => (
            <li key={i} className="text-xs text-default leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
          Expected result
        </h4>
        <p className="text-xs text-default bg-surface border border-border rounded p-2 leading-relaxed">
          {c.expectedResult}
        </p>
      </div>
    </div>
  )
}

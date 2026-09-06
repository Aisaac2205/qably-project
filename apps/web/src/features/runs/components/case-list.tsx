'use client'

import type { RunCaseRecord } from '@qably/types'
import { StatusChip } from './status-chip'
import { useTranslation } from '@/lib/i18n'
import { describeCase } from '@/features/projects/suites/lib/case-title'

export function CaseList({
  cases,
  selectedId,
  onSelect,
}: {
  cases: RunCaseRecord[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  
  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted p-4">
        {t('runs.noCases')}
      </div>
    )
  }

  return (
    <div className="h-full divide-y divide-border" role="listbox" aria-label={t('runs.ariaRunCases')}>
      {cases.map((c) => {
        const isSelected = c.id === selectedId
        const described = describeCase(c)
        const showRawName = described.raw !== described.title
        return (
          <button
            key={c.id}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-surface-hover/70 outline-none focus:outline-none focus-visible:outline-none ${
              isSelected
                ? 'bg-surface-hover text-default font-semibold'
                : 'text-muted'
            }`}
          >
            <div className="shrink-0">
              <StatusChip status={c.status} />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`block text-xs truncate ${isSelected ? 'text-default font-semibold' : 'text-default'}`}>
                {described.title}
              </span>
              {showRawName && (
                <span className="block font-mono text-[10px] text-muted truncate">
                  {described.raw}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

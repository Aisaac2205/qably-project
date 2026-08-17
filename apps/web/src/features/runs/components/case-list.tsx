'use client'

import type { RunCase } from '@qably/types'
import { StatusChip } from './status-chip'
import { useTranslation } from '@/lib/i18n'

export function CaseList({
  cases,
  selectedId,
  onSelect,
}: {
  cases: RunCase[]
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
            <span className={`text-xs truncate ${isSelected ? 'text-default font-semibold' : 'text-default'}`}>
              {c.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

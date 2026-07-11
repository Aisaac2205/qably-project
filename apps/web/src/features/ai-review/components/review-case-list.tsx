'use client'

import type { AiCase } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { AiStatusChip } from './ai-status-chip'
import { CopySimple, ChatCircleText, GitBranch } from '@phosphor-icons/react'

export function ReviewCaseList({
  cases,
  selectedId,
  onSelect,
  filter = 'all',
}: {
  cases: AiCase[]
  selectedId?: string
  onSelect: (id: string) => void
  filter?: 'all' | 'duplicates'
}) {
  const visibleCases = filter === 'duplicates' ? cases.filter((c) => c.duplicateOfCaseId) : cases

  if (visibleCases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted p-4">
        {filter === 'duplicates' ? 'No possible duplicates' : 'No AI cases pending review'}
      </div>
    )
  }

  return (
    <Card className="rounded-none border-0 h-full">
      <CardContent className="p-0">
        <ul className="divide-y divide-border" role="listbox" aria-label="AI review cases">
          {visibleCases.map((c) => {
            const isSelected = c.id === selectedId
            return (
              <li key={c.id}>
                <button
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary ${
                    isSelected
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-default truncate flex items-center gap-1.5">
                      {c.source === 'chat' ? (
                        <ChatCircleText size={12} className="text-ai shrink-0" aria-label="Generated from chat" />
                      ) : (
                        <GitBranch size={12} className="text-muted shrink-0" aria-label="Generated from webhook" />
                      )}
                      {c.name}
                    </span>
                    <AiStatusChip status={c.reviewStatus} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono truncate">
                    {c.duplicateOfCaseId && (
                      <CopySimple size={11} className="text-warn shrink-0" weight="bold" aria-label="Possible duplicate" />
                    )}
                    {c.sourceFile}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

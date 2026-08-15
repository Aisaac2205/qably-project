'use client'

import type { AiCase } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { AiStatusChip } from './ai-status-chip'
import { CopySimple, ChatCircleText, GitBranch, Target } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'

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
  const { t } = useTranslation()
  const visibleCases = filter === 'duplicates'
    ? cases.filter((c) => c.possibleDuplicateOf ?? c.duplicateOfCaseId)
    : cases

  if (visibleCases.length === 0) {
    return (
      <StateView kind="empty" title={filter === 'duplicates' ? t('aiReview.noDuplicates') : t('aiReview.noCasesPending')} className="h-full" />
    )
  }

  return (
    <Card className="rounded-none border-0 h-full">
      <CardContent className="p-0">
        <EntityList aria-label={t('aiReview.ariaReviewCases')}>
          {visibleCases.map((c) => {
            const isSelected = c.id === selectedId
            const possibleDuplicateOf = c.possibleDuplicateOf ?? c.duplicateOfCaseId
            return (
              <li key={c.id}>
                <button
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary ${
                    isSelected
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-default truncate flex items-center gap-2">
                      {c.source === 'chat' ? (
                        <ChatCircleText size={14} className="text-ai shrink-0" aria-label={t('aiReview.ariaGeneratedChat')} />
                      ) : (
                        <GitBranch size={14} className="text-muted shrink-0" aria-label={t('aiReview.ariaGeneratedWebhook')} />
                      )}
                      {c.name}
                    </span>
                    <AiStatusChip status={c.reviewStatus} />
                  </div>
                   <div className="flex flex-wrap items-center gap-1.5 pl-6 text-xs text-muted">
                     {possibleDuplicateOf && (
                       <Badge variant="warn">
                         <CopySimple size={12} weight="bold" aria-hidden="true" />
                         {t('aiReview.possibleDuplicate')}
                       </Badge>
                     )}
                     {c.coverageGapId && (
                       <Badge variant="default">
                         <Target size={12} weight="bold" aria-hidden="true" />
                         {t('aiReview.coverageGapSuggestion')}
                       </Badge>
                     )}
                     <span className="font-mono truncate">{c.sourceFile}</span>
                   </div>
                </button>
              </li>
            )
          })}
        </EntityList>
      </CardContent>
    </Card>
  )
}

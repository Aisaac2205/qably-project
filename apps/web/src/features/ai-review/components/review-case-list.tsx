'use client'

import type { ExtractedProposal } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { CopySimple, ChatCircleText, GitBranch } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'
import { useEvidence } from '@/lib/use-mock-store'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'

function ReviewCaseListRow({
  proposal,
  isSelected,
  onSelect,
}: {
  proposal: ExtractedProposal
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const evidence = useEvidence(proposal.evidenceId)
  const isChatOrigin = evidence?.kind === 'artifact'

  return (
    <li>
      <button
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(proposal.id)}
        className={`w-full text-left px-3.5 py-2.5 sm:px-4 sm:py-3 transition-colors hover:bg-surface-hover/70 focus-visible:outline-2 focus-visible:outline-primary ${
          isSelected
            ? 'bg-surface-hover/90 border-l-2 border-primary'
            : 'border-l-2 border-transparent'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs sm:text-sm font-semibold text-default truncate flex items-center gap-2">
            {isChatOrigin ? (
              <ChatCircleText size={14} className="text-ai shrink-0" aria-label={t('aiReview.ariaGeneratedChat')} />
            ) : (
              <GitBranch size={14} className="text-muted shrink-0" aria-label={t('aiReview.ariaGeneratedWebhook')} />
            )}
            {proposal.title}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-5 text-xs text-muted">
          {proposal.targetOfficialTestCaseId && (
            <Badge variant="warn" className="text-[10px] px-1.5 py-0.5 font-medium">
              <CopySimple size={10} weight="bold" aria-hidden="true" />
              {t('aiReview.possibleDuplicate')}
            </Badge>
          )}
          {evidence?.title && <span className="font-mono text-[11px] text-muted truncate">{evidence.title}</span>}
        </div>
      </button>
    </li>
  )
}

export function ReviewCaseList({
  proposals,
  selectedId,
  onSelect,
  filter = 'all',
}: {
  proposals: ExtractedProposal[]
  selectedId?: string
  onSelect: (id: string) => void
  filter?: 'all' | 'duplicates'
}) {
  const { t } = useTranslation()
  const visibleProposals = filter === 'duplicates'
    ? proposals.filter((p) => p.targetOfficialTestCaseId)
    : proposals

  if (visibleProposals.length === 0) {
    return (
      <StateView kind="empty" title={filter === 'duplicates' ? t('aiReview.noDuplicates') : t('aiReview.noCasesPending')} className="h-full" />
    )
  }

  return (
    <Card className="rounded-none border-0 h-full">
      <CardContent className="p-0">
        <EntityList aria-label={t('aiReview.ariaReviewCases')}>
          {visibleProposals.map((proposal) => (
            <ReviewCaseListRow
              key={proposal.id}
              proposal={proposal}
              isSelected={proposal.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </EntityList>
      </CardContent>
    </Card>
  )
}

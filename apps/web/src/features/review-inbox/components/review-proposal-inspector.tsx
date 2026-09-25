'use client'

import type { ExtractedProposal } from '@qably/types'
import { DuplicateComparison } from './duplicate-comparison'
import { InspectorHeader } from './inspector/inspector-header'
import { ManualReviewNotice } from './inspector/manual-review-notice'
import { ProposalContentSections } from './inspector/proposal-content-sections'
import { InspectorEvidence } from './inspector/inspector-evidence'
import { DecisionToolbar } from './inspector/decision-toolbar'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProposal } from '../hooks/use-proposals'

interface ReviewProposalInspectorProps {
  proposal: ExtractedProposal
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isSubmitting?: boolean
}

export function ReviewProposalInspector({
  proposal,
  onApprove,
  onReject,
  isSubmitting = false,
}: ReviewProposalInspectorProps) {
  const { project } = useProject(proposal.projectId)
  const { proposal: detail } = useProposal(proposal.id)
  const evidence = detail?.evidence ?? undefined
  const links = detail?.links ?? []

  const needsManualReview = proposal.needsManualReview || proposal.steps.length === 0

  const formattedDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sep 9, 01:23 PM'

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-surface">
      <div className="flex-1 overflow-y-auto space-y-6 p-6 sm:p-7 pb-10">
        <InspectorHeader
          proposal={proposal}
          project={project}
          evidenceTitle={evidence?.title}
          formattedDate={formattedDate}
        />

        {proposal.possibleDuplicate && <DuplicateComparison proposalId={proposal.id} />}

        {needsManualReview && <ManualReviewNotice proposal={proposal} />}

        <ProposalContentSections proposal={proposal} needsManualReview={needsManualReview} />

        <InspectorEvidence
          observations={proposal.observations}
          evidence={evidence}
          links={links}
        />
      </div>

      <DecisionToolbar
        proposal={proposal}
        project={project}
        onApprove={onApprove}
        onReject={onReject}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

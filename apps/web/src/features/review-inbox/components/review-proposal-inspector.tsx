'use client'

import type { RefObject } from 'react'
import type { ExtractedProposal } from '@qably/types'
import { DuplicateComparison } from './duplicate-comparison'
import { InspectorHeader } from './inspector/inspector-header'
import { ManualReviewNotice } from './inspector/manual-review-notice'
import { ProposalContentSections } from './inspector/proposal-content-sections'
import { InspectorEvidence } from './inspector/inspector-evidence'
import { InspectorPublication } from './inspector/inspector-publication'
import { DecisionToolbar } from './inspector/decision-toolbar'
import type { InboxSuite, ProposalClassification } from '../api/review.api'
import { resolveClassification } from '../lib/classification-reason'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProposal } from '../hooks/use-proposals'

interface ReviewProposalInspectorProps {
  proposal: ExtractedProposal & {
    suite?: InboxSuite | null
    classification?: ProposalClassification
  }
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isSubmitting?: boolean
  headingRef?: RefObject<HTMLHeadingElement | null>
}

export function ReviewProposalInspector({
  proposal,
  onApprove,
  onReject,
  isSubmitting = false,
  headingRef,
}: ReviewProposalInspectorProps) {
  const { project } = useProject(proposal.projectId)
  const { proposal: detail } = useProposal(proposal.id)
  const evidence = detail?.evidence ?? undefined
  const links = detail?.links ?? []

  const needsManualReview = proposal.needsManualReview || proposal.steps.length === 0
  const classification = resolveClassification(proposal.classification)

  const formattedDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-surface">
      <div className="flex-1 overflow-y-auto space-y-6 p-6 sm:p-7 pb-10">
        <InspectorHeader
          proposal={proposal}
          project={project}
          evidenceTitle={evidence?.title}
          formattedDate={formattedDate}
          headingRef={headingRef}
        />

        {classification.kind !== 'none' && (
          <DuplicateComparison classification={classification} />
        )}

        {needsManualReview && <ManualReviewNotice proposal={proposal} />}

        <ProposalContentSections
          proposal={proposal}
          needsManualReview={needsManualReview}
          publishedVersion={detail?.publishedVersion ?? null}
        />

        <InspectorEvidence
          observations={proposal.observations}
          evidence={evidence}
          links={links}
        />

        <InspectorPublication
          projectId={proposal.projectId}
          matchedCase={detail?.matchedCase ?? null}
          source={detail?.source ?? null}
          recentRuns={detail?.recentRuns ?? []}
          decision={detail?.decision ?? null}
          publishedVersion={detail?.publishedVersion ?? null}
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

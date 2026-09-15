import type { CiCommitActivityRecord, ExtractedProposal, RunSummaryRecord } from '@qably/types'
import { projectRunPath, reviewInboxProposalPath } from '@/features/projects/lib/routes'

/**
 * Resolves the destination for a recent-activity run row. Mirrors the
 * "undefined means non-navigable" convention from resolveNotificationLink.
 */
export function resolveRunLink(run: RunSummaryRecord): string | undefined {
  return projectRunPath(run.projectId, run.id)
}

/**
 * Resolves the destination for a pending-proposal row, preselecting it in
 * the review inbox.
 */
export function resolveProposalLink(proposal: ExtractedProposal): string | undefined {
  return reviewInboxProposalPath(proposal.id)
}

/**
 * CiCommitActivityRecord carries no projectId, so there is no destination to
 * link to yet. Kept explicit and testable so the row renders non-navigable
 * instead of pointing at an ambiguous generic screen — update this the day
 * the API adds a projectId to the record.
 */
export function resolveCiCommitLink(_commit: CiCommitActivityRecord): undefined {
  return undefined
}

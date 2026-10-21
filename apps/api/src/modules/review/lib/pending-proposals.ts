/**
 * Which proposals keep a case "in review": the ones waiting for a decision
 * that target it, or that were matched to it as a possible duplicate. A
 * manual-review fallback does not count, since documenting the case replaces
 * it. The suite view applies the same rule to show the "In review" chip
 * (`SuiteViewAssembler`), so what the suite shows and what documentation
 * skips agree.
 */
export function pendingProposalsWhere(caseIds: readonly string[]) {
  return {
    status: 'in_review' as const,
    needsManualReview: false,
    OR: [
      { targetTestCaseId: { in: [...caseIds] } },
      { matchedCaseId: { in: [...caseIds] } },
    ],
  };
}

export const PENDING_PROPOSAL_CASES_SELECT = {
  targetTestCaseId: true,
  matchedCaseId: true,
} as const;

export interface PendingProposalCases {
  targetTestCaseId: string | null;
  matchedCaseId?: string | null;
}

export function casesWithPendingProposal(
  rows: readonly PendingProposalCases[],
): Set<string> {
  const caseIds = new Set<string>();

  for (const row of rows) {
    for (const caseId of [row.targetTestCaseId, row.matchedCaseId]) {
      if (typeof caseId === 'string') caseIds.add(caseId);
    }
  }

  return caseIds;
}

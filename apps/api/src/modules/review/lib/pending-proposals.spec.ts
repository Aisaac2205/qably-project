import {
  casesWithPendingProposal,
  pendingProposalsWhere,
} from './pending-proposals';

describe('pendingProposalsWhere', () => {
  it('matches proposals waiting for review that target or were matched to the cases, leaving manual-review fallbacks out', () => {
    expect(pendingProposalsWhere(['case-1', 'case-2'])).toEqual({
      status: 'in_review',
      needsManualReview: false,
      OR: [
        { targetTestCaseId: { in: ['case-1', 'case-2'] } },
        { matchedCaseId: { in: ['case-1', 'case-2'] } },
      ],
    });
  });
});

describe('casesWithPendingProposal', () => {
  it('collects both the targeted and the matched case of each proposal', () => {
    expect(
      casesWithPendingProposal([
        { targetTestCaseId: 'case-1', matchedCaseId: 'case-2' },
        { targetTestCaseId: null, matchedCaseId: 'case-3' },
        { targetTestCaseId: 'case-4' },
      ]),
    ).toEqual(new Set(['case-1', 'case-2', 'case-3', 'case-4']));
  });

  it('is empty when nothing is waiting', () => {
    expect(casesWithPendingProposal([])).toEqual(new Set());
  });
});

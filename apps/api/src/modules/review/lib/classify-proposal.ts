import {
  scoreDuplicateCandidate,
  type DuplicateReason,
} from './rank-duplicate-candidates';

export type ProposalDuplicateKind = 'none' | 'update' | 'possible_duplicate';

export interface ClassifyProposalInput {
  automationKey: string | null;
  suiteId: string | null;
  title: string;
  steps: readonly string[];
  expectedResult: string;
}

export interface ClassifyProposalCandidate {
  id: string;
  suiteId: string;
  automationKey: string | null;
  title: string;
  steps: readonly string[];
  expectedResult: string;
}

export interface ProposalClassification {
  kind: ProposalDuplicateKind;
  matchedCaseId: string | null;
  score: number | null;
  reasons: (DuplicateReason | 'same-automation-key' | 'cross-suite-key')[];
}

const POSSIBLE_DUPLICATE_THRESHOLD = 0.6;

function normalizeAutomationKey(key: string | null): string | null {
  if (key === null) return null;
  const trimmed = key.trim();
  return trimmed.length === 0 ? null : trimmed;
}

interface ScoredCandidate {
  candidate: ClassifyProposalCandidate;
  score: number;
  reasons: DuplicateReason[];
}

function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.candidate.id < b.candidate.id
    ? -1
    : a.candidate.id > b.candidate.id
      ? 1
      : 0;
}

export function classifyProposal(
  proposal: ClassifyProposalInput,
  candidates: readonly ClassifyProposalCandidate[],
  defaultSuiteId: string,
): ProposalClassification {
  const effectiveSuiteId = proposal.suiteId ?? defaultSuiteId;
  const inSuite = candidates.filter(
    (candidate) => candidate.suiteId === effectiveSuiteId,
  );

  const proposalKey = normalizeAutomationKey(proposal.automationKey);

  const exactKeyMatch =
    proposalKey === null
      ? null
      : (inSuite.find(
          (candidate) =>
            normalizeAutomationKey(candidate.automationKey) === proposalKey,
        ) ?? null);

  let base: ProposalClassification;

  if (exactKeyMatch !== null) {
    base = {
      kind: 'update',
      matchedCaseId: exactKeyMatch.id,
      score: 1,
      reasons: ['same-automation-key'],
    };
  } else {
    const scored: ScoredCandidate[] = inSuite
      .map((candidate) => ({
        candidate,
        ...scoreDuplicateCandidate(proposal, candidate),
      }))
      .filter((entry) => entry.score >= POSSIBLE_DUPLICATE_THRESHOLD)
      .sort(compareScored);

    const best = scored[0];
    base =
      best === undefined
        ? { kind: 'none', matchedCaseId: null, score: null, reasons: [] }
        : {
            kind: 'possible_duplicate',
            matchedCaseId: best.candidate.id,
            score: best.score,
            reasons: best.reasons,
          };
  }

  const hasCrossSuiteKeyMatch =
    proposalKey !== null &&
    candidates.some(
      (candidate) =>
        candidate.suiteId !== effectiveSuiteId &&
        normalizeAutomationKey(candidate.automationKey) === proposalKey,
    );

  return hasCrossSuiteKeyMatch
    ? { ...base, reasons: [...base.reasons, 'cross-suite-key'] }
    : base;
}

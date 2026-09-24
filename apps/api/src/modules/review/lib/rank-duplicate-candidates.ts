import { normalizeTitle } from '../../../common/quality/case-health';
import { jaccard, tokenize } from './text-similarity';

export type DuplicateMatchReason = 'automation-key' | 'title' | 'token-overlap';

export interface DuplicateRankTarget {
  title: string;
  automationKey: string | null;
}

export interface DuplicateRankCandidate {
  id: string;
  title: string;
  steps: readonly string[];
  expectedResult: string;
  automationKey: string | null;
  publishedAt: Date;
}

export interface RankedDuplicateCandidate {
  id: string;
  title: string;
  steps: readonly string[];
  expectedResult: string;
  matchReason: DuplicateMatchReason;
}

const JACCARD_THRESHOLD = 0.6;
const MAX_RANKED_CANDIDATES = 5;

const MATCH_REASON_TIER: Record<DuplicateMatchReason, number> = {
  'automation-key': 0,
  title: 1,
  'token-overlap': 2,
};

interface ScoredCandidate {
  candidate: DuplicateRankCandidate;
  matchReason: DuplicateMatchReason;
  score: number;
}

function matchFor(
  target: DuplicateRankTarget,
  candidate: DuplicateRankCandidate,
): ScoredCandidate | null {
  if (
    target.automationKey !== null &&
    candidate.automationKey === target.automationKey
  ) {
    return { candidate, matchReason: 'automation-key', score: 1 };
  }

  const targetTitle = normalizeTitle(target.title);
  const candidateTitle = normalizeTitle(candidate.title);
  if (targetTitle.length > 0 && targetTitle === candidateTitle) {
    return { candidate, matchReason: 'title', score: 1 };
  }

  const overlap = jaccard(tokenize(target.title), tokenize(candidate.title));
  if (overlap >= JACCARD_THRESHOLD) {
    return { candidate, matchReason: 'token-overlap', score: overlap };
  }

  return null;
}

function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  const tierDiff =
    MATCH_REASON_TIER[a.matchReason] - MATCH_REASON_TIER[b.matchReason];
  if (tierDiff !== 0) return tierDiff;

  if (a.score !== b.score) return b.score - a.score;

  const publishedDiff =
    b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime();
  if (publishedDiff !== 0) return publishedDiff;

  return a.candidate.id < b.candidate.id
    ? -1
    : a.candidate.id > b.candidate.id
      ? 1
      : 0;
}

export function rankDuplicateCandidates(
  target: DuplicateRankTarget,
  candidates: readonly DuplicateRankCandidate[],
): RankedDuplicateCandidate[] {
  const scored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    const match = matchFor(target, candidate);
    if (match !== null) scored.push(match);
  }

  scored.sort(compareScored);

  return scored
    .slice(0, MAX_RANKED_CANDIDATES)
    .map(({ candidate, matchReason }) => ({
      id: candidate.id,
      title: candidate.title,
      steps: candidate.steps,
      expectedResult: candidate.expectedResult,
      matchReason,
    }));
}

import { normalizeTitle } from '../../../common/quality/case-health';
import { jaccard, tokenize } from './text-similarity';

export function normalizeAutomationKey(key: string | null): string | null {
  if (key === null) return null;
  const trimmed = key.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export type DuplicateReason =
  | 'same-title'
  | 'title-overlap'
  | 'steps-overlap'
  | 'expected-result-overlap';

export interface DuplicateScoringTarget {
  title: string;
  steps: readonly string[];
  expectedResult: string;
}

export interface DuplicateScoringCandidate {
  title: string;
  steps: readonly string[];
  expectedResult: string;
}

export interface DuplicateScore {
  score: number;
  reasons: DuplicateReason[];
}

const TITLE_WEIGHT = 0.5;
const STEPS_WEIGHT = 0.3;
const EXPECTED_RESULT_WEIGHT = 0.2;

function textJaccard(a: string, b: string): number {
  return jaccard(tokenize(a), tokenize(b));
}

export function scoreDuplicateCandidate(
  target: DuplicateScoringTarget,
  candidate: DuplicateScoringCandidate,
): DuplicateScore {
  const targetTitle = normalizeTitle(target.title);
  const candidateTitle = normalizeTitle(candidate.title);
  const exactTitle = targetTitle.length > 0 && targetTitle === candidateTitle;

  const titleSimilarity = exactTitle
    ? 1
    : textJaccard(target.title, candidate.title);
  const stepsSimilarity = textJaccard(
    target.steps.join(' '),
    candidate.steps.join(' '),
  );
  const expectedResultSimilarity = textJaccard(
    target.expectedResult,
    candidate.expectedResult,
  );

  const score = exactTitle
    ? 1
    : titleSimilarity * TITLE_WEIGHT +
      stepsSimilarity * STEPS_WEIGHT +
      expectedResultSimilarity * EXPECTED_RESULT_WEIGHT;

  const reasons: DuplicateReason[] = [];
  if (exactTitle) reasons.push('same-title');
  else if (titleSimilarity > 0) reasons.push('title-overlap');
  if (stepsSimilarity > 0) reasons.push('steps-overlap');
  if (expectedResultSimilarity > 0) reasons.push('expected-result-overlap');

  return { score, reasons };
}

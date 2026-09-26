import type { TargetManifestEntry, TargetTag } from '../../ai/target-reference';
import { parseTargetRef } from '../../ai/target-reference';
import { normalizeAutomationKey } from './normalize-automation-key';

export interface TargetLike {
  readonly testCaseId: string;
  readonly automationKey: string;
}

export interface MatchableCase {
  readonly automationKey: string;
  readonly targetRef?: string;
}

export interface MatchRoundResult<
  T extends TargetLike,
  C extends MatchableCase,
> {
  readonly matched: readonly { readonly target: T; readonly testCase: C }[];
  readonly unmatched: readonly T[];
}

/**
 * Deduplicates by the RAW (non-normalized) automationKey, first occurrence
 * wins. This is the single source of truth for that rule: extraction.processor.ts
 * imports this instead of keeping its own copy, since it already depends on
 * this module for `matchRound` — importing one more thing from the same
 * module adds no new dependency edge (and the reverse direction, this file
 * importing from the processor, would create a cycle).
 */
export function dedupeByAutomationKey<C extends MatchableCase>(
  cases: readonly C[],
): C[] {
  const seen = new Set<string>();
  const deduped: C[] = [];

  for (const testCase of cases) {
    if (seen.has(testCase.automationKey)) continue;
    seen.add(testCase.automationKey);
    deduped.push(testCase);
  }

  return deduped;
}

function hasConflictingTarget<T extends TargetLike>(
  targets: readonly T[],
  taggedTarget: T,
  normalizedCaseKey: string,
): boolean {
  return targets.some(
    (candidate) =>
      candidate.testCaseId !== taggedTarget.testCaseId &&
      normalizeAutomationKey(candidate.automationKey) === normalizedCaseKey,
  );
}

/**
 * Resolves opaque `T{n}` tag citations first, with a cross-check against
 * drifted/conflicting automationKeys, then falls back to today's normalized
 * key matching for everything the tag phase did not resolve. Must run over
 * the raw, pre-dedupe cases array — tag citations are per-case, not per
 * automationKey.
 */
export function matchRound<T extends TargetLike, C extends MatchableCase>(
  targets: readonly T[],
  cases: readonly C[],
  manifest: ReadonlyMap<TargetTag, TargetManifestEntry<T>>,
): MatchRoundResult<T, C> {
  const citationsByTag = new Map<TargetTag, C[]>();

  for (const testCase of cases) {
    const tag = parseTargetRef(testCase.targetRef);
    if (tag === undefined) continue;
    if (!manifest.has(tag)) continue;

    const citations = citationsByTag.get(tag);
    if (citations === undefined) {
      citationsByTag.set(tag, [testCase]);
    } else {
      citations.push(testCase);
    }
  }

  const tagMatchByTestCaseId = new Map<string, C>();
  const consumed = new Set<C>();

  for (const [tag, citations] of citationsByTag) {
    if (citations.length !== 1) continue;

    const [testCase] = citations;
    const entry = manifest.get(tag);
    if (entry === undefined) continue;

    const normalizedCaseKey = normalizeAutomationKey(testCase.automationKey);
    if (hasConflictingTarget(targets, entry.target, normalizedCaseKey)) {
      continue;
    }

    tagMatchByTestCaseId.set(entry.target.testCaseId, testCase);
    consumed.add(testCase);
  }

  const unconsumedCases = cases.filter((testCase) => !consumed.has(testCase));
  const byAutomationKey = new Map(
    dedupeByAutomationKey(unconsumedCases).map((testCase) => [
      normalizeAutomationKey(testCase.automationKey),
      testCase,
    ]),
  );

  const matched: { target: T; testCase: C }[] = [];
  const unmatched: T[] = [];

  for (const target of targets) {
    const tagMatch = tagMatchByTestCaseId.get(target.testCaseId);
    if (tagMatch !== undefined) {
      matched.push({ target, testCase: tagMatch });
      continue;
    }

    const keyMatch = byAutomationKey.get(
      normalizeAutomationKey(target.automationKey),
    );
    if (keyMatch === undefined) {
      unmatched.push(target);
    } else {
      matched.push({ target, testCase: keyMatch });
    }
  }

  return { matched, unmatched };
}

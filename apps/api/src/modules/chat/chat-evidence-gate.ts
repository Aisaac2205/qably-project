import type { ExcerptOutcome } from './case-context-builder';

export type EvidenceGateResult =
  | { kind: 'code-backed'; excerpt: string }
  | { kind: 'no-code-evidence'; reason: string };

export function gate(outcome: ExcerptOutcome | null): EvidenceGateResult {
  if (outcome === null) {
    return { kind: 'no-code-evidence', reason: 'no-evidence' };
  }
  if (outcome.kind === 'unavailable') {
    return { kind: 'no-code-evidence', reason: outcome.reason };
  }
  if (outcome.excerpt.trim().length === 0) {
    return { kind: 'no-code-evidence', reason: 'empty-excerpt' };
  }
  return { kind: 'code-backed', excerpt: outcome.excerpt };
}

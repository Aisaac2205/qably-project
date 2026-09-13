import type { Locale } from '@qably/i18n';
import { isLocaleStale } from './stale-locale';

export type DocumentableCaseMode = 'undocumented' | 'stale-locale';

export type CaseNotDocumentableReason =
  | 'out-of-scope'
  | 'not-automated'
  | 'already-pending'
  | 'no-automation-key';

export type DocumentableCaseVerdict =
  | { documentable: true }
  | { documentable: false; reason: CaseNotDocumentableReason };

export interface DocumentableCaseCandidate {
  executionMode: string;
  steps: readonly string[];
  documentedLocale: string | null | undefined;
  automationKey: string | null | undefined;
  hasPendingProposal: boolean;
}

const DOCUMENTABLE: DocumentableCaseVerdict = { documentable: true };

function rejected(reason: CaseNotDocumentableReason): DocumentableCaseVerdict {
  return { documentable: false, reason };
}

function matchesMode(
  candidate: DocumentableCaseCandidate,
  mode: DocumentableCaseMode,
  orgDefaultLocale: Locale,
): boolean {
  if (mode === 'undocumented') return candidate.steps.length === 0;

  return (
    candidate.steps.length > 0 &&
    isLocaleStale(
      { steps: candidate.steps, documentedLocale: candidate.documentedLocale },
      orgDefaultLocale,
    )
  );
}

export function classifyDocumentableCase(
  candidate: DocumentableCaseCandidate,
  mode: DocumentableCaseMode,
  orgDefaultLocale: Locale,
): DocumentableCaseVerdict {
  if (!matchesMode(candidate, mode, orgDefaultLocale)) {
    return rejected('out-of-scope');
  }
  if (candidate.executionMode !== 'automated') return rejected('not-automated');
  if (candidate.hasPendingProposal) return rejected('already-pending');
  if (
    candidate.automationKey === null ||
    candidate.automationKey === undefined
  ) {
    return rejected('no-automation-key');
  }

  return DOCUMENTABLE;
}

export function isCaseDocumentable(
  candidate: DocumentableCaseCandidate,
  mode: DocumentableCaseMode,
  orgDefaultLocale: Locale,
): boolean {
  return classifyDocumentableCase(candidate, mode, orgDefaultLocale)
    .documentable;
}

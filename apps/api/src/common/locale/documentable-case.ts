import type { Locale } from '@qably/i18n';
import { isLocaleStale } from './stale-locale';

export type DocumentableCaseMode = 'undocumented' | 'stale-locale';

export interface DocumentableCaseCandidate {
  executionMode: string;
  steps: readonly string[];
  documentedLocale: string | null | undefined;
  automationKey: string | null | undefined;
  hasPendingProposal: boolean;
}

export function isCaseDocumentable(
  candidate: DocumentableCaseCandidate,
  mode: DocumentableCaseMode,
  orgDefaultLocale: Locale,
): boolean {
  if (candidate.executionMode !== 'automated') return false;
  if (
    candidate.automationKey === null ||
    candidate.automationKey === undefined
  ) {
    return false;
  }
  if (candidate.hasPendingProposal) return false;

  if (mode === 'undocumented') return candidate.steps.length === 0;

  return (
    candidate.steps.length > 0 &&
    isLocaleStale(
      { steps: candidate.steps, documentedLocale: candidate.documentedLocale },
      orgDefaultLocale,
    )
  );
}

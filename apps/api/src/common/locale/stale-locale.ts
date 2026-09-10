import type { Locale } from '@qably/i18n';

export interface StaleLocaleCandidate {
  steps: readonly string[];
  documentedLocale: string | null | undefined;
}

export function isLocaleStale(
  candidate: StaleLocaleCandidate,
  orgDefaultLocale: Locale,
): boolean {
  if (candidate.steps.length === 0) return false;

  return (
    candidate.documentedLocale === null ||
    candidate.documentedLocale === undefined ||
    candidate.documentedLocale !== orgDefaultLocale
  );
}

export function staleLocaleWhere(orgDefaultLocale: Locale): {
  NOT: { steps: { equals: never[] } };
  OR: (
    | { currentVersion: null }
    | { currentVersion: { locale: null } }
    | { currentVersion: { locale: { not: Locale } } }
  )[];
} {
  return {
    NOT: { steps: { equals: [] } },
    OR: [
      { currentVersion: null },
      { currentVersion: { locale: null } },
      { currentVersion: { locale: { not: orgDefaultLocale } } },
    ],
  };
}

import type { TestCase } from '@qably/types'

const LOCALE_NAME_KEYS: Record<string, string> = {
  es: 'suites.localeNameEs',
  en: 'suites.localeNameEn',
}

export function countDocumentableCases(cases: readonly TestCase[]): number {
  return cases.filter(
    (testCase) =>
      testCase.executionMode === 'automated' &&
      testCase.steps.length === 0 &&
      !testCase.pendingProposalId,
  ).length
}

export function isStaleLocale(testCase: TestCase, viewerLocale: string): boolean {
  return (
    testCase.steps.length > 0 &&
    testCase.documentedLocale !== undefined &&
    testCase.documentedLocale !== null &&
    testCase.documentedLocale !== viewerLocale
  )
}

export function countStaleLocaleCases(
  cases: readonly TestCase[],
  viewerLocale: string,
): number {
  return cases.filter(
    (testCase) =>
      testCase.executionMode === 'automated' &&
      !testCase.pendingProposalId &&
      isStaleLocale(testCase, viewerLocale),
  ).length
}

export function localeNameKey(locale: string): string {
  return LOCALE_NAME_KEYS[locale] ?? 'suites.localeNameOther'
}

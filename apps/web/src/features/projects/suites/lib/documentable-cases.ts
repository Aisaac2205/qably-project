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

export function localeNameKey(locale: string): string {
  return LOCALE_NAME_KEYS[locale] ?? 'suites.localeNameOther'
}

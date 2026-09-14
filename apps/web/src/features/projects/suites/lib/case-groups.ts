import type { TestCase } from '@qably/types'
import { deriveCaseAttention } from './case-attention'

export const GROUP_CASES_THRESHOLD = 8

export interface CaseGroup {
  key: 'needsAttention' | 'documented'
  cases: TestCase[]
}

/**
 * Splits a suite's cases into a needs-attention group and a documented group
 * once the list is long enough that a scanner benefits from the landmark.
 * Returns null for short suites, where the flat list stays flat.
 */
export function groupCasesForDisplay(cases: readonly TestCase[]): CaseGroup[] | null {
  if (cases.length <= GROUP_CASES_THRESHOLD) return null

  const needsAttention = cases.filter((tc) => deriveCaseAttention(tc) !== null)
  const documented = cases.filter((tc) => deriveCaseAttention(tc) === null)

  const groups: CaseGroup[] = []
  if (needsAttention.length > 0) groups.push({ key: 'needsAttention', cases: needsAttention })
  if (documented.length > 0) groups.push({ key: 'documented', cases: documented })
  return groups
}

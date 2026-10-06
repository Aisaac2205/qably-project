import type { CaseStatus, SuiteRunStatus, SuiteSummarySort, TestCase } from '@qably/types'

export type SortKey = SuiteSummarySort
export type StatusFilter = SuiteRunStatus | 'all'
export type TagFilter = string

export interface FilterOption<T> {
  readonly value: T
  readonly label: string
}

type Translate = (key: string, params?: Record<string, string | number>) => string

export function buildStatusOptions(t: Translate): FilterOption<StatusFilter>[] {
  return [
    { value: 'all', label: t('suites.filterAllStatuses') },
    { value: 'pass', label: t('common.pass') },
    { value: 'fail', label: t('common.fail') },
    { value: 'running', label: t('common.running') },
    { value: 'needs-attention', label: t('suites.filterNeedsAttention') },
    { value: 'never-run', label: t('suites.filterNeverRun') },
  ]
}

export function buildTagOptions(t: Translate, availableTags: string[]): FilterOption<TagFilter>[] {
  return [
    { value: 'all', label: t('suites.allTags') },
    ...availableTags.map((tag) => ({ value: tag, label: tag })),
  ]
}

export function buildSortOptions(t: Translate): FilterOption<SortKey>[] {
  return [
    { value: 'recent', label: t('suites.sortMostRecent') },
    { value: 'name', label: t('suites.sortName') },
    { value: 'pass-rate', label: t('suites.sortHighestPassRate') },
    { value: 'cases', label: t('suites.sortMostCases') },
  ]
}

export function optionLabel<T>(options: readonly FilterOption<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? ''
}

export function countActiveFilters(status: StatusFilter, tag: TagFilter): number {
  return (status === 'all' ? 0 : 1) + (tag === 'all' ? 0 : 1)
}

export type CaseResultFilter = CaseStatus | 'all' | 'never-run'

export function buildCaseResultOptions(t: Translate): FilterOption<CaseResultFilter>[] {
  return [
    { value: 'all', label: t('suites.filterAllResults') },
    { value: 'pass', label: t('status.execution.pass') },
    { value: 'fail', label: t('status.execution.fail') },
    { value: 'skip', label: t('status.execution.skip') },
    { value: 'blocked', label: t('status.execution.blocked') },
    { value: 'never-run', label: t('status.execution.neverRun') },
  ]
}

export function matchesCaseResult(testCase: TestCase, filter: CaseResultFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'never-run') return !testCase.lastResult
  return testCase.lastResult?.status === filter
}

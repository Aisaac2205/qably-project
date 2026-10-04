export const RUNS_TABS = ['actions', 'manual'] as const

export type RunsTab = (typeof RUNS_TABS)[number]

export const DEFAULT_RUNS_TAB: RunsTab = 'actions'

export function parseRunsTab(value: unknown): RunsTab {
  return RUNS_TABS.find((tab) => tab === value) ?? DEFAULT_RUNS_TAB
}

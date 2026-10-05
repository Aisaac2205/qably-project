export const runKeys = {
  all: ['runs'] as const,
  list: (projectId: string) => ['runs', 'list', projectId] as const,
  page: (projectId: string, source: string) =>
    ['runs', 'page', projectId, source] as const,
  pageUngrouped: (projectId: string, source: string) =>
    ['runs', 'page', projectId, source, 'ungrouped'] as const,
  details: ['runs', 'detail'] as const,
  detail: (id: string) => ['runs', 'detail', id] as const,
  suiteMetrics: (projectId: string) =>
    ['runs', 'suite-metrics', projectId] as const,
  regressions: (projectId: string, limit: number) =>
    ['runs', 'regressions', projectId, limit] as const,
  pushPassRate: (projectId: string, days: number) =>
    ['runs', 'push-pass-rate', projectId, days] as const,
}

export const ciRunKeys = {
  all: ['ci-runs'] as const,
  page: (projectId: string) => ['ci-runs', 'page', projectId] as const,
  detail: (id: string) => ['ci-runs', 'detail', id] as const,
}

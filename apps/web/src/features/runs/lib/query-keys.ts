export const runKeys = {
  all: ['runs'] as const,
  list: (projectId: string) => ['runs', 'list', projectId] as const,
  page: (projectId: string, source: string) =>
    ['runs', 'page', projectId, source] as const,
  detail: (id: string) => ['runs', id] as const,
  suiteMetrics: (projectId: string) =>
    ['runs', 'suite-metrics', projectId] as const,
  regressions: (projectId: string, limit: number) =>
    ['runs', 'regressions', projectId, limit] as const,
  recent: (projectId: string, limit: number) =>
    ['runs', 'recent', projectId, limit] as const,
}

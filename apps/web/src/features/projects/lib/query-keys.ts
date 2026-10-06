import type { SuiteSummariesQuery } from '../suites/lib/suite-summaries-query'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  repository: (id: string) => ['projects', id, 'repository'] as const,
}

export const suiteKeys = {
  all: ['suites'] as const,
  list: (projectId: string) => ['suites', 'list', projectId] as const,
  summaries: (projectId: string) => ['suites', 'summaries', projectId] as const,
  summaryPage: (projectId: string, query: SuiteSummariesQuery) =>
    ['suites', 'summaries', projectId, query] as const,
  tags: (projectId: string) => ['suites', 'tags', projectId] as const,
  detail: (id: string) => ['suites', id] as const,
}

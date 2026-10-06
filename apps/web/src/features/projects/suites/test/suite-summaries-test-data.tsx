import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SuiteSummariesPage, SuiteSummary } from '@qably/types'
import type { SuiteSummariesFilters } from '@/features/projects/suites/lib/suite-summaries-query'

export const NO_FILTERS: SuiteSummariesFilters = {
  sort: 'recent',
  search: '',
  status: 'all',
  tag: 'all',
}

export function summary(id: string, overrides: Partial<SuiteSummary> = {}): SuiteSummary {
  return {
    id,
    projectId: 'proj-1',
    name: `Suite ${id}`,
    description: '',
    tags: [],
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    caseCount: 0,
    status: 'never-run',
    recentPassRate: null,
    ...overrides,
  }
}

export function pageOf(ids: string[], nextCursor: string | null = null): SuiteSummariesPage {
  return { items: ids.map((id) => summary(id)), nextCursor }
}

export function idsOf(rows: { id: string }[]): string[] {
  return rows.map((row) => row.id)
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })

  return { promise, resolve, reject }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

export function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockSuites } from '@/lib/mock-data'
import { suiteKeys } from '@/features/projects/lib/query-keys'

/**
 * Suites used to come from a synchronous store, so component tests could
 * assert straight after render. They now arrive over react-query, so the
 * cache is seeded with the same fixtures to keep those assertions honest
 * without rewriting every test into a waitFor.
 */
function seedSuites(client: QueryClient): void {
  const suites = structuredClone(mockSuites)

  client.setQueryData(suiteKeys.list('all'), suites)

  for (const projectId of new Set(suites.map((suite) => suite.projectId))) {
    client.setQueryData(
      suiteKeys.list(projectId),
      suites.filter((suite) => suite.projectId === projectId),
    )
  }

  for (const suite of suites) {
    client.setQueryData(suiteKeys.detail(suite.id), suite)
  }
}

export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  seedSuites(client)

  return client
}

export function withQueryClient(children: ReactNode): ReactElement {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

export function renderWithQuery(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  return render(withQueryClient(ui), options)
}

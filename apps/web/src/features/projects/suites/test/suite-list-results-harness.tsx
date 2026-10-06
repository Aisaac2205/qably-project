import { act, render } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { SuiteListResults } from '@/features/projects/suites/components/suite-list-results'
import type { SuiteSummariesFilters } from '@/features/projects/suites/lib/suite-summaries-query'
import { NO_FILTERS, createQueryClient } from './suite-summaries-test-data'

export interface ResultsOverrides {
  projectId?: string
  filters?: SuiteSummariesFilters
}

export const EMPTY_PAGE: SuiteSummariesPage = { items: [], nextCursor: null }

export const NO_SUITES_PROJECT = 'proj-empty'

export async function renderResults(
  overrides: ResultsOverrides = {},
  client: QueryClient = createQueryClient(),
) {
  const onClearFilters = vi.fn()
  const element = (next: ResultsOverrides) => (
    <QueryClientProvider client={client}>
      <SuiteListResults
        projectId="proj-1"
        filters={NO_FILTERS}
        onClearFilters={onClearFilters}
        {...overrides}
        {...next}
      />
    </QueryClientProvider>
  )
  let view!: ReturnType<typeof render>

  await act(async () => {
    view = render(element({}))
  })

  return {
    client,
    onClearFilters,
    rerenderWith: (next: ResultsOverrides) =>
      act(async () => {
        view.rerender(element(next))
      }),
  }
}

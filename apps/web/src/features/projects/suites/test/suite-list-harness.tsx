import { act, render, screen } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { SuiteList } from '@/features/projects/suites/components/suite-list'
import { createQueryClient } from './suite-summaries-test-data'

export async function renderList(
  projectId = 'proj-1',
  client: QueryClient = createQueryClient(),
) {
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <SuiteList projectId={projectId} />
      </QueryClientProvider>,
    )
  })

  return { client }
}

export function resultsArea(): HTMLElement {
  return screen.getByTestId('suite-list-results')
}

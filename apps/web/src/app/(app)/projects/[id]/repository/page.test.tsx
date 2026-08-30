import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { getProjectRepository } from '@/features/projects/repository/api/repository.api'
import RepositoryPage from './page'

vi.mock('@/features/projects/repository/api/repository.api', () => ({
  getProjectRepository: vi.fn(),
}))

describe('RepositoryPage', () => {
  it('awaits Next.js Promise params before rendering the project repository', async () => {
    vi.mocked(getProjectRepository).mockResolvedValue({
      source: {
        provider: 'GITHUB',
        repo: 'acme/ecommerce-app',
        testFilePatterns: ['*.spec.ts', '*.test.ts'],
      },
      batch: null,
      codeChanges: [],
      evidence: [],
    })

    const page = await RepositoryPage({ params: Promise.resolve({ id: 'proj-1' }) })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

    await act(async () => {
      render(<QueryClientProvider client={client}>{page}</QueryClientProvider>)
    })

    await waitFor(() => {
      expect(screen.getByText('acme/ecommerce-app')).toBeInTheDocument()
    })
    expect(getProjectRepository).toHaveBeenCalledWith('proj-1', expect.anything())
  })
})

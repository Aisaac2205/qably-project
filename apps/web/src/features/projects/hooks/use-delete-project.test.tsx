import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useDeleteProject } from './use-delete-project'
import { deleteProject } from '../api/projects.api'

vi.mock('../api/projects.api', () => ({ deleteProject: vi.fn() }))

const remove = vi.mocked(deleteProject)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  remove.mockResolvedValue(undefined)
})

describe('useDeleteProject', () => {
  it('deletes against the api instead of a local store', async () => {
    const { result } = renderHook(() => useDeleteProject(), { wrapper })

    result.current.remove('p1')

    await waitFor(() => expect(remove).toHaveBeenCalledWith('p1'))
  })

  it('surfaces a rejected deletion instead of pretending it worked', async () => {
    remove.mockRejectedValue(new Error('forbidden'))
    const { result } = renderHook(() => useDeleteProject(), { wrapper })

    result.current.remove('p1')

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

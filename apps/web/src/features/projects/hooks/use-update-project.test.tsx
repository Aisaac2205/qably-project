import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useUpdateProject } from './use-update-project'
import { updateProject } from '../api/projects.api'

vi.mock('../api/projects.api', () => ({ updateProject: vi.fn() }))

const update = vi.mocked(updateProject)

const project = {
  id: 'p1',
  name: 'Renamed',
  organizationId: 'org-1',
  technologies: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  update.mockResolvedValue(project)
})

describe('useUpdateProject', () => {
  it('persists the change against the api instead of a local store', async () => {
    const { result } = renderHook(() => useUpdateProject(), { wrapper })

    result.current.update('p1', { name: 'Renamed' })

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('p1', { name: 'Renamed' })
    })
  })

  it('unlinks a repository by sending an explicit null', async () => {
    const { result } = renderHook(() => useUpdateProject(), { wrapper })

    result.current.update('p1', { connectionId: null })

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('p1', { connectionId: null })
    })
  })

  it('surfaces the failure so the dialog can keep the draft', async () => {
    update.mockRejectedValue(new Error('conflict'))
    const { result } = renderHook(() => useUpdateProject(), { wrapper })

    result.current.update('p1', { name: 'Taken' })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useProject } from './use-project'
import { getProject } from '../api/projects.api'

vi.mock('../api/projects.api', () => ({ getProject: vi.fn() }))

const read = vi.mocked(getProject)

const project = {
  id: 'cm7real',
  name: 'Checkout',
  organizationId: 'org-1',
  technologies: ['react'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  read.mockResolvedValue(project)
})

describe('useProject', () => {
  it('reads a project the api created rather than a seeded mock id', async () => {
    const { result } = renderHook(() => useProject('cm7real'), { wrapper })

    await waitFor(() => expect(result.current.project).toEqual(project))
    expect(read).toHaveBeenCalledWith('cm7real', expect.anything())
  })

  it('reports loading so the page does not flash a not-found state', () => {
    const { result } = renderHook(() => useProject('cm7real'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.project).toBeUndefined()
  })

  it('never asks the api for an empty id', () => {
    renderHook(() => useProject(''), { wrapper })

    expect(read).not.toHaveBeenCalled()
  })

  it('surfaces a missing project instead of hanging', async () => {
    read.mockRejectedValue(new Error('not found'))
    const { result } = renderHook(() => useProject('gone'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.project).toBeUndefined()
  })
})

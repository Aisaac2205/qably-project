import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useProjects } from './use-projects'
import { listProjects } from '../api/projects.api'

vi.mock('../api/projects.api', () => ({ listProjects: vi.fn() }))

const list = vi.mocked(listProjects)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const project = {
  id: 'p1',
  name: 'Checkout',
  organizationId: 'org-1',
  technologies: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  suiteCount: 3,
  activity: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([project])
})

describe('useProjects', () => {
  it('starts empty instead of undefined so the grid can render immediately', () => {
    const { result } = renderHook(() => useProjects(), { wrapper })

    expect(result.current.projects).toEqual([])
  })

  it('returns the projects the api served', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper })

    await waitFor(() => expect(result.current.projects).toEqual([project]))
  })

  it('surfaces the failure instead of pretending there are no projects', async () => {
    list.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useProjects(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.projects).toEqual([])
  })
})

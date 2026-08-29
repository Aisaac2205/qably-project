import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useConnections } from './use-connections'
import { listConnections } from '../api/connections.api'

vi.mock('../api/connections.api', () => ({ listConnections: vi.fn() }))

const list = vi.mocked(listConnections)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const connection = {
  id: 'conn-1',
  organizationId: 'org-1',
  provider: 'GITHUB' as const,
  name: 'Primary',
  repo: 'acme/shop',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([connection])
})

describe('useConnections', () => {
  it('starts empty so a form can render before the request settles', () => {
    const { result } = renderHook(() => useConnections(), { wrapper })

    expect(result.current.connections).toEqual([])
  })

  it('returns the connections the api served', async () => {
    const { result } = renderHook(() => useConnections(), { wrapper })

    await waitFor(() =>
      expect(result.current.connections).toEqual([connection]),
    )
  })

  it('reports the empty case so the form can explain why no repo is selectable', async () => {
    list.mockResolvedValue([])

    const { result } = renderHook(() => useConnections(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.connections).toEqual([])
  })
})

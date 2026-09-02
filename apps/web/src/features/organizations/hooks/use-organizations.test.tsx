import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useOrganizations } from './use-organizations'
import { listOrganizations } from '../api/organizations.api'

vi.mock('../api/organizations.api', () => ({ listOrganizations: vi.fn() }))

const list = vi.mocked(listOrganizations)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const organization = {
  id: 'org-1',
  name: 'Acme QA Team',
  slug: 'acme-qa',
  plan: 'equipo' as const,
  role: 'owner' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([organization])
})

describe('useOrganizations', () => {
  it('starts empty so a caller can render before the request settles', () => {
    const { result } = renderHook(() => useOrganizations(), { wrapper })

    expect(result.current.organizations).toEqual([])
  })

  it('returns the organizations the api served', async () => {
    const { result } = renderHook(() => useOrganizations(), { wrapper })

    await waitFor(() =>
      expect(result.current.organizations).toEqual([organization]),
    )
  })

  it('surfaces the failure instead of pretending there are no organizations', async () => {
    list.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useOrganizations(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.organizations).toEqual([])
  })
})

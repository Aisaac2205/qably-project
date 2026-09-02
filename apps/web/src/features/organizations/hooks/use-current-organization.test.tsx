import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useCurrentOrganization } from './use-current-organization'
import { listOrganizations } from '../api/organizations.api'

vi.mock('../api/organizations.api', () => ({ listOrganizations: vi.fn() }))

const list = vi.mocked(listOrganizations)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const first = {
  id: 'org-1',
  name: 'Acme QA Team',
  slug: 'acme-qa',
  plan: 'equipo' as const,
  role: 'owner' as const,
}

const second = {
  id: 'org-2',
  name: 'Second workspace',
  slug: 'second-workspace',
  plan: 'gratuito' as const,
  role: 'member' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([first, second])
})

describe('useCurrentOrganization', () => {
  it('starts undefined so a caller can render before the request settles', () => {
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper })

    expect(result.current.organization).toBeUndefined()
  })

  it('resolves to the earliest-joined membership, mirroring the api default', async () => {
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper })

    await waitFor(() => expect(result.current.organization).toEqual(first))
  })
})

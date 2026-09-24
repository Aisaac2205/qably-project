import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useCurrentOrganization } from './use-current-organization'
import { listOrganizations } from '../api/organizations.api'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'
import { useSession } from '@/lib/auth-client'

vi.mock('../api/organizations.api', () => ({ listOrganizations: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }))

const list = vi.mocked(listOrganizations)
const readSession = vi.mocked(useSession)

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
  useActiveOrganizationStore.setState({ organizationId: null, userId: null })
  readSession.mockReturnValue({
    data: { user: { id: 'user-1' } },
    isPending: false,
  } as never)
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

  it('prefers the stored active organization when it belongs to the current user', async () => {
    useActiveOrganizationStore.setState({ organizationId: 'org-2', userId: 'user-1' })
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper })

    await waitFor(() => expect(result.current.organization).toEqual(second))
  })

  it('falls back to the earliest-joined membership when the stored organization is not in the list', async () => {
    useActiveOrganizationStore.setState({ organizationId: 'org-unknown', userId: 'user-1' })
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper })

    await waitFor(() => expect(result.current.organization).toEqual(first))
  })

  it('ignores and clears a stored organization that belongs to a different user', async () => {
    useActiveOrganizationStore.setState({ organizationId: 'org-2', userId: 'user-previous' })
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper })

    await waitFor(() => expect(result.current.organization).toEqual(first))
    await waitFor(() => expect(useActiveOrganizationStore.getState().organizationId).toBeNull())
    expect(useActiveOrganizationStore.getState().userId).toBeNull()
  })

  it('does not treat a stored organization as stale while the session is still resolving', async () => {
    readSession.mockReturnValue({ data: undefined, isPending: true } as never)
    useActiveOrganizationStore.setState({ organizationId: 'org-2', userId: 'user-1' })
    renderHook(() => useCurrentOrganization(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-2')
  })
})

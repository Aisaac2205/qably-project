import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useInvites } from './use-invites'
import { listInvites, type OrgInviteSummary } from '../api/invites.api'

vi.mock('../api/invites.api', () => ({ listInvites: vi.fn() }))

const list = vi.mocked(listInvites)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const invite: OrgInviteSummary = {
  id: 'invite-1',
  email: 'new@acme.test',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-08T00:00:00.000Z',
  invitedByName: 'Ada Lovelace',
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([invite])
})

describe('useInvites', () => {
  it('starts empty so a caller can render before the request settles', () => {
    const { result } = renderHook(() => useInvites(true), { wrapper })

    expect(result.current.invites).toEqual([])
  })

  it('returns the pending invites the api served', async () => {
    const { result } = renderHook(() => useInvites(true), { wrapper })

    await waitFor(() => expect(result.current.invites).toEqual([invite]))
  })

  it('does not call the api when disabled', () => {
    renderHook(() => useInvites(false), { wrapper })

    expect(list).not.toHaveBeenCalled()
  })
})

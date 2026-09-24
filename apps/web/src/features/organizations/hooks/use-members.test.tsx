import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { OrgMember } from '@qably/types'
import { useMembers } from './use-members'
import { listMembers } from '../api/members.api'

vi.mock('../api/members.api', () => ({ listMembers: vi.fn() }))

const list = vi.mocked(listMembers)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const member: OrgMember = {
  id: 'member-1',
  userId: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@acme.test',
  role: 'owner',
  joinedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([member])
})

describe('useMembers', () => {
  it('starts empty so a caller can render before the request settles', () => {
    const { result } = renderHook(() => useMembers(true), { wrapper })

    expect(result.current.members).toEqual([])
  })

  it('returns the members the api served', async () => {
    const { result } = renderHook(() => useMembers(true), { wrapper })

    await waitFor(() => expect(result.current.members).toEqual([member]))
  })

  it('does not call the api when disabled', () => {
    renderHook(() => useMembers(false), { wrapper })

    expect(list).not.toHaveBeenCalled()
  })
})

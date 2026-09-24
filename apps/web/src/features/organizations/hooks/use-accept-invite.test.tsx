import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useAcceptInvite } from './use-accept-invite'
import { acceptInvite } from '../api/invites.api'

vi.mock('../api/invites.api', () => ({ acceptInvite: vi.fn() }))

const accept = vi.mocked(acceptInvite)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  accept.mockResolvedValue({ organizationId: 'org-2' })
})

describe('useAcceptInvite', () => {
  it('accepts the invite token and returns the joined organization', async () => {
    const { result } = renderHook(() => useAcceptInvite(), { wrapper })

    let outcome: { organizationId: string } | undefined
    await act(async () => {
      outcome = await result.current.mutateAsync('tok123')
    })

    expect(accept).toHaveBeenCalledWith('tok123')
    expect(outcome).toEqual({ organizationId: 'org-2' })
  })
})

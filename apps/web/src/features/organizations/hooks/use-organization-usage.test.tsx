import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { OrganizationUsageRecord } from '@qably/types'
import { useOrganizationUsage } from './use-organization-usage'
import { getUsage } from '../api/organizations.api'

vi.mock('../api/organizations.api', () => ({ getUsage: vi.fn() }))

const request = vi.mocked(getUsage)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const usage: OrganizationUsageRecord = {
  plan: 'equipo',
  limits: { members: 10, projects: 5, monthlyAiCredits: 300 },
  members: 2,
  pendingInvites: 1,
  projects: 3,
  aiEnabled: true,
  aiCreditsUsed: 12,
  creditsResetAt: '2026-10-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  request.mockResolvedValue(usage)
})

describe('useOrganizationUsage', () => {
  it('starts with no usage record so a caller can render before the request settles', () => {
    const { result } = renderHook(() => useOrganizationUsage(), { wrapper })

    expect(result.current.usage).toBeUndefined()
  })

  it('returns the usage record the api served', async () => {
    const { result } = renderHook(() => useOrganizationUsage(), { wrapper })

    await waitFor(() => expect(result.current.usage).toEqual(usage))
  })

  it('surfaces a load error when the request fails', async () => {
    request.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useOrganizationUsage(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

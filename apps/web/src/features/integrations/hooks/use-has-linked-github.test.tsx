import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useHasLinkedGithub } from './use-has-linked-github'

const listAccounts = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    listAccounts: (...args: unknown[]) => listAccounts(...args),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHasLinkedGithub', () => {
  it('starts unresolved so callers can hide the prompt until the check settles', () => {
    listAccounts.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useHasLinkedGithub(), { wrapper })

    expect(result.current.hasLinkedGithub).toBeNull()
    expect(result.current.isLoading).toBe(true)
  })

  it('resolves true when a github account is linked', async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: 'github' }],
      error: null,
    })

    const { result } = renderHook(() => useHasLinkedGithub(), { wrapper })

    await waitFor(() => expect(result.current.hasLinkedGithub).toBe(true))
  })

  it('resolves false when the linked accounts do not include github', async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: 'credential' }],
      error: null,
    })

    const { result } = renderHook(() => useHasLinkedGithub(), { wrapper })

    await waitFor(() => expect(result.current.hasLinkedGithub).toBe(false))
  })

  it('resolves false when the account list is empty', async () => {
    listAccounts.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useHasLinkedGithub(), { wrapper })

    await waitFor(() => expect(result.current.hasLinkedGithub).toBe(false))
  })

  it('resolves false when the request errors instead of throwing', async () => {
    listAccounts.mockResolvedValue({ data: null, error: { code: 'NETWORK' } })

    const { result } = renderHook(() => useHasLinkedGithub(), { wrapper })

    await waitFor(() => expect(result.current.hasLinkedGithub).toBe(false))
  })
})

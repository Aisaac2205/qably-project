import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryProvider } from './query-provider'
import { getRegisteredQueryClient, resetQueryClientRegistry } from '@/lib/query-client-registry'
import { ACTIVE_ORGANIZATION_STORAGE_KEY, useActiveOrganizationStore } from '@/stores/active-organization.store'

beforeEach(() => {
  localStorage.clear()
  useActiveOrganizationStore.setState({ organizationId: null, userId: null })
})

afterEach(() => {
  resetQueryClientRegistry()
})

describe('QueryProvider', () => {
  it('registers its query client so non-React modules can reach it', async () => {
    await act(async () => {
      render(
        <QueryProvider>
          <div>content</div>
        </QueryProvider>,
      )
    })

    expect(getRegisteredQueryClient()).not.toBeNull()
  })

  it('rehydrates the active organization store and resets the query cache when another tab changes it', async () => {
    await act(async () => {
      render(
        <QueryProvider>
          <div>content</div>
        </QueryProvider>,
      )
    })

    const queryClient = getRegisteredQueryClient()
    if (!queryClient) throw new Error('expected a registered query client')
    const resetSpy = vi.spyOn(queryClient, 'resetQueries')

    localStorage.setItem(
      ACTIVE_ORGANIZATION_STORAGE_KEY,
      JSON.stringify({ state: { organizationId: 'org-9', userId: 'user-9' }, version: 0 }),
    )

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: ACTIVE_ORGANIZATION_STORAGE_KEY }),
      )
      await Promise.resolve()
    })

    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-9')
    expect(resetSpy).toHaveBeenCalled()
  })

  it('ignores storage events for unrelated keys', async () => {
    await act(async () => {
      render(
        <QueryProvider>
          <div>content</div>
        </QueryProvider>,
      )
    })

    const queryClient = getRegisteredQueryClient()
    if (!queryClient) throw new Error('expected a registered query client')
    const resetSpy = vi.spyOn(queryClient, 'resetQueries')

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }))
      await Promise.resolve()
    })

    expect(resetSpy).not.toHaveBeenCalled()
  })
})

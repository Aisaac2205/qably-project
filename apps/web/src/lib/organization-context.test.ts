import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyOrganizationChange, resetQueriesForOrganizationChange } from './organization-context'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'

beforeEach(() => {
  localStorage.clear()
  useActiveOrganizationStore.setState({ organizationId: null, userId: null })
})

describe('resetQueriesForOrganizationChange', () => {
  it('does nothing when no query client is registered', async () => {
    await expect(resetQueriesForOrganizationChange(null)).resolves.toBeUndefined()
  })

  it('cancels in-flight queries before resetting so a switch cannot be overwritten by a stale response', async () => {
    const queryClient = new QueryClient()
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries').mockResolvedValue(undefined)
    const resetSpy = vi.spyOn(queryClient, 'resetQueries').mockResolvedValue(undefined)

    await resetQueriesForOrganizationChange(queryClient)

    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(resetSpy).toHaveBeenCalledTimes(1)
    const cancelOrder = cancelSpy.mock.invocationCallOrder[0]
    const resetOrder = resetSpy.mock.invocationCallOrder[0]
    expect(cancelOrder).toBeLessThan(resetOrder)
  })
})

describe('applyOrganizationChange', () => {
  it('persists the new organization and its owning user', async () => {
    await applyOrganizationChange(null, { organizationId: 'org-2', userId: 'user-1' })

    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-2')
    expect(useActiveOrganizationStore.getState().userId).toBe('user-1')
  })

  it('clears the store when switching to no organization', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-2', 'user-1')

    await applyOrganizationChange(null, null)

    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
    expect(useActiveOrganizationStore.getState().userId).toBeNull()
  })

  it('resets the query cache through the same path used by both callers', async () => {
    const queryClient = new QueryClient()
    const resetSpy = vi.spyOn(queryClient, 'resetQueries').mockResolvedValue(undefined)
    vi.spyOn(queryClient, 'cancelQueries').mockResolvedValue(undefined)

    await applyOrganizationChange(queryClient, { organizationId: 'org-2', userId: 'user-1' })

    expect(resetSpy).toHaveBeenCalledTimes(1)
  })
})

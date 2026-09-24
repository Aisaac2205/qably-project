import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACTIVE_ORGANIZATION_STORAGE_KEY,
  useActiveOrganizationStore,
} from './active-organization.store'

beforeEach(() => {
  localStorage.clear()
  useActiveOrganizationStore.setState({ organizationId: null, userId: null })
})

describe('useActiveOrganizationStore', () => {
  it('starts with no active organization', () => {
    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
    expect(useActiveOrganizationStore.getState().userId).toBeNull()
  })

  it('persists the selected organization and its owning user under the qably-active-organization key', () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-2', 'user-1')

    const stored = JSON.parse(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) ?? '{}')
    expect(stored.state.organizationId).toBe('org-2')
    expect(stored.state.userId).toBe('user-1')
  })

  it('restores the persisted organization and user on rehydrate', async () => {
    localStorage.setItem(
      ACTIVE_ORGANIZATION_STORAGE_KEY,
      JSON.stringify({ state: { organizationId: 'org-3', userId: 'user-3' }, version: 0 }),
    )

    await useActiveOrganizationStore.persist.rehydrate()

    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-3')
    expect(useActiveOrganizationStore.getState().userId).toBe('user-3')
  })

  it('clears the active organization, its owning user, and the storage entry', () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-2', 'user-1')

    useActiveOrganizationStore.getState().clearActiveOrganization()

    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
    expect(useActiveOrganizationStore.getState().userId).toBeNull()
    const stored = JSON.parse(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) ?? '{}')
    expect(stored.state.organizationId).toBeNull()
    expect(stored.state.userId).toBeNull()
  })
})

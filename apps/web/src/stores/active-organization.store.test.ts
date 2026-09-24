import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACTIVE_ORGANIZATION_STORAGE_KEY,
  useActiveOrganizationStore,
} from './active-organization.store'

beforeEach(() => {
  localStorage.clear()
  useActiveOrganizationStore.setState({ organizationId: null })
})

describe('useActiveOrganizationStore', () => {
  it('starts with no active organization', () => {
    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
  })

  it('persists the selected organization under the qably-active-organization key', () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-2')

    const stored = JSON.parse(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) ?? '{}')
    expect(stored.state.organizationId).toBe('org-2')
  })

  it('restores the persisted organization on rehydrate', async () => {
    localStorage.setItem(
      ACTIVE_ORGANIZATION_STORAGE_KEY,
      JSON.stringify({ state: { organizationId: 'org-3' }, version: 0 }),
    )

    await useActiveOrganizationStore.persist.rehydrate()

    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-3')
  })

  it('clears the active organization and its storage entry', () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-2')

    useActiveOrganizationStore.getState().clearActiveOrganization()

    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
    const stored = JSON.parse(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) ?? '{}')
    expect(stored.state.organizationId).toBeNull()
  })
})

import type { QueryClient } from '@tanstack/react-query'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'

export interface OrganizationChange {
  organizationId: string
  userId: string
}

export async function resetQueriesForOrganizationChange(
  queryClient: QueryClient | null,
): Promise<void> {
  if (!queryClient) return

  await queryClient.cancelQueries()
  await queryClient.resetQueries()
}

export async function applyOrganizationChange(
  queryClient: QueryClient | null,
  next: OrganizationChange | null,
): Promise<void> {
  if (next) {
    useActiveOrganizationStore.getState().setActiveOrganization(next.organizationId, next.userId)
  } else {
    useActiveOrganizationStore.getState().clearActiveOrganization()
  }

  await resetQueriesForOrganizationChange(queryClient)
}

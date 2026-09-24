'use client'

import { useEffect } from 'react'
import type { OrganizationSummary } from '@qably/types'
import { useOrganizations } from './use-organizations'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'
import { useSession } from '@/lib/auth-client'

export interface CurrentOrganizationResult {
  organization: OrganizationSummary | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Prefers the persisted active organization when it is still one of the
 * caller's memberships AND it was stored by the currently signed-in user.
 * A stored organization that belongs to a different user (e.g. the
 * previous account on a shared browser) is ignored and cleared, so a
 * stale org id can never leak into this user's view or into api-client
 * requests that read the store directly. Otherwise falls back to the
 * earliest-joined membership, which mirrors the api's own default when no
 * x-organization-id header is sent (/organizations lists memberships in
 * that same joinedAt order).
 */
export function useCurrentOrganization(): CurrentOrganizationResult {
  const { organizations, isLoading, isError, error } = useOrganizations()
  const { data: session, isPending: isSessionPending } = useSession()
  const currentUserId = session?.user.id ?? null

  const storedOrganizationId = useActiveOrganizationStore((state) => state.organizationId)
  const storedUserId = useActiveOrganizationStore((state) => state.userId)

  const storedBelongsToCurrentUser =
    !isSessionPending && storedOrganizationId !== null && storedUserId === currentUserId

  useEffect(() => {
    if (isSessionPending) return
    if (storedOrganizationId === null) return
    if (storedUserId === currentUserId) return

    useActiveOrganizationStore.getState().clearActiveOrganization()
  }, [isSessionPending, storedOrganizationId, storedUserId, currentUserId])

  const activeOrganizationId = storedBelongsToCurrentUser ? storedOrganizationId : undefined

  const activeOrganization = activeOrganizationId
    ? organizations.find((organization) => organization.id === activeOrganizationId)
    : undefined

  return {
    organization: activeOrganization ?? organizations[0],
    isLoading,
    isError,
    error,
  }
}

import type { InvitePreviewRecord, OrgRole } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface OrgInviteSummary {
  id: string
  email: string
  role: OrgRole
  createdAt: string
  expiresAt: string
  invitedByName: string | null
}

export interface CreateInviteResult extends OrgInviteSummary {
  emailDelivered: boolean
}

export interface CreateInvitePayload {
  email: string
  role: Extract<OrgRole, 'admin' | 'member'>
}

export function listInvites(signal?: AbortSignal): Promise<OrgInviteSummary[]> {
  return apiRequest<OrgInviteSummary[]>('/organizations/current/invites', { signal })
}

export function createInvite(
  payload: CreateInvitePayload,
): Promise<CreateInviteResult> {
  return apiRequest<CreateInviteResult>('/organizations/current/invites', {
    method: 'POST',
    body: payload,
  })
}

export function revokeInvite(inviteId: string): Promise<void> {
  return apiRequest<void>(`/organizations/current/invites/${inviteId}`, {
    method: 'DELETE',
  })
}

export function resendInvite(inviteId: string): Promise<CreateInviteResult> {
  return apiRequest<CreateInviteResult>(
    `/organizations/current/invites/${inviteId}/resend`,
    { method: 'POST' },
  )
}

export function previewInvite(token: string): Promise<InvitePreviewRecord> {
  return apiRequest<InvitePreviewRecord>('/invites/preview', {
    method: 'POST',
    body: { token },
  })
}

export function acceptInvite(token: string): Promise<{ organizationId: string }> {
  return apiRequest<{ organizationId: string }>('/invites/accept', {
    method: 'POST',
    body: { token },
  })
}

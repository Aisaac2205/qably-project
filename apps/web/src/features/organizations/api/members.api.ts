import type { OrgMember, OrgRole } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export function listMembers(signal?: AbortSignal): Promise<OrgMember[]> {
  return apiRequest<OrgMember[]>('/organizations/current/members', { signal })
}

export function changeMemberRole(
  memberId: string,
  role: OrgRole,
): Promise<OrgMember> {
  return apiRequest<OrgMember>(`/organizations/current/members/${memberId}`, {
    method: 'PATCH',
    body: { role },
  })
}

export function removeMember(memberId: string): Promise<void> {
  return apiRequest<void>(`/organizations/current/members/${memberId}`, {
    method: 'DELETE',
  })
}

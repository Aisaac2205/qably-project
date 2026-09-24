import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeMemberRole, listMembers, removeMember } from './members.api'
import { apiRequest } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue(undefined)
})

describe('members api', () => {
  it('lists members from the current organization route', async () => {
    await listMembers()

    expect(request).toHaveBeenCalledWith(
      '/organizations/current/members',
      expect.anything(),
    )
  })

  it('changes a member role with a PATCH to the member route', async () => {
    await changeMemberRole('member-1', 'admin')

    expect(request).toHaveBeenCalledWith('/organizations/current/members/member-1', {
      method: 'PATCH',
      body: { role: 'admin' },
    })
  })

  it('removes a member with a DELETE to the member route', async () => {
    await removeMember('member-1')

    expect(request).toHaveBeenCalledWith('/organizations/current/members/member-1', {
      method: 'DELETE',
    })
  })
})

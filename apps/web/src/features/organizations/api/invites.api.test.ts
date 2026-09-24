import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptInvite,
  createInvite,
  listInvites,
  previewInvite,
  resendInvite,
  revokeInvite,
} from './invites.api'
import { apiRequest } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue(undefined)
})

describe('invites api', () => {
  it('lists pending invites from the current organization route', async () => {
    await listInvites()

    expect(request).toHaveBeenCalledWith(
      '/organizations/current/invites',
      expect.anything(),
    )
  })

  it('creates an invite with an email and a role', async () => {
    await createInvite({ email: 'new@acme.test', role: 'member' })

    expect(request).toHaveBeenCalledWith('/organizations/current/invites', {
      method: 'POST',
      body: { email: 'new@acme.test', role: 'member' },
    })
  })

  it('revokes an invite with a DELETE to its id', async () => {
    await revokeInvite('invite-1')

    expect(request).toHaveBeenCalledWith('/organizations/current/invites/invite-1', {
      method: 'DELETE',
    })
  })

  it('resends an invite by posting to its resend sub-path', async () => {
    await resendInvite('invite-1')

    expect(request).toHaveBeenCalledWith(
      '/organizations/current/invites/invite-1/resend',
      { method: 'POST' },
    )
  })

  it('previews a public invite token without an organization header', async () => {
    await previewInvite('tok123')

    expect(request).toHaveBeenCalledWith('/invites/preview', {
      method: 'POST',
      body: { token: 'tok123' },
    })
  })

  it('accepts a public invite token', async () => {
    await acceptInvite('tok123')

    expect(request).toHaveBeenCalledWith('/invites/accept', {
      method: 'POST',
      body: { token: 'tok123' },
    })
  })
})

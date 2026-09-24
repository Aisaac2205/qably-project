import { describe, expect, it } from 'vitest'
import { classifyInviteError } from './use-invite-mutations'
import { ApiError } from '@/lib/api-client'

describe('classifyInviteError', () => {
  it('maps a seat-limit-reached api error to its own code', () => {
    expect(
      classifyInviteError(new ApiError(403, 'nope', 'seat-limit-reached')),
    ).toBe('seat-limit-reached')
  })

  it('maps an already-member api error to its own code', () => {
    expect(classifyInviteError(new ApiError(409, 'nope', 'already-member'))).toBe(
      'already-member',
    )
  })

  it('falls back to a generic error for an unrecognized api code', () => {
    expect(classifyInviteError(new ApiError(500, 'nope', 'boom'))).toBe('error')
  })

  it('falls back to a generic error for a non-api failure', () => {
    expect(classifyInviteError(new TypeError('network down'))).toBe('error')
  })
})

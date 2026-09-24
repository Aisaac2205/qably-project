import { describe, expect, it } from 'vitest'
import { classifyMemberError } from './use-member-mutations'
import { ApiError } from '@/lib/api-client'

describe('classifyMemberError', () => {
  it('maps a last-owner-required api error to its own code', () => {
    expect(classifyMemberError(new ApiError(409, 'nope', 'last-owner-required'))).toBe(
      'last-owner-required',
    )
  })

  it('maps a forbidden api error to its own code', () => {
    expect(classifyMemberError(new ApiError(403, 'nope', 'forbidden'))).toBe('forbidden')
  })

  it('falls back to a generic error for an unrecognized api code', () => {
    expect(classifyMemberError(new ApiError(500, 'nope', 'boom'))).toBe('error')
  })

  it('falls back to a generic error for a non-api failure', () => {
    expect(classifyMemberError(new TypeError('network down'))).toBe('error')
  })
})

import { describe, expect, it } from 'vitest'
import { classifyWebhookError } from './use-notification-webhook-mutations'
import { ApiError } from '@/lib/api-client'

describe('classifyWebhookError', () => {
  it('maps a plan-limit-reached api error to its own code', () => {
    expect(
      classifyWebhookError(new ApiError(403, 'nope', 'plan-limit-reached')),
    ).toBe('plan-limit-reached')
  })

  it('falls back to a generic error for an unrecognized api code', () => {
    expect(classifyWebhookError(new ApiError(500, 'nope', 'boom'))).toBe('error')
  })

  it('falls back to a generic error for a non-api failure', () => {
    expect(classifyWebhookError(new TypeError('network down'))).toBe('error')
  })
})

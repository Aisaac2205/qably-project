import { describe, expect, it } from 'vitest'
import { toAuthMessage } from '@/features/auth/lib/auth-errors'

describe('toAuthMessage', () => {
  it('gives the same answer for a wrong password and an unknown account', () => {
    expect(toAuthMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'Invalid email or password',
    )
    expect(toAuthMessage({ code: 'USER_NOT_FOUND' })).toBe(
      'Invalid email or password',
    )
  })

  it('tells a returning user their email is already registered', () => {
    expect(toAuthMessage({ code: 'USER_ALREADY_EXISTS' })).toBe(
      'That email is already registered',
    )
    expect(toAuthMessage({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe(
      'That email is already registered',
    )
  })

  it('states the real password length the api enforces', () => {
    expect(toAuthMessage({ code: 'PASSWORD_TOO_SHORT' })).toBe(
      'Password must be at least 12 characters',
    )
  })

  it('explains a rate limit', () => {
    expect(toAuthMessage({ status: 429 })).toBe(
      'Too many attempts. Wait a moment and try again.',
    )
  })

  it('falls back to the message the api sent when the code is unknown', () => {
    expect(toAuthMessage({ code: 'SOMETHING_NEW', message: 'Account locked' })).toBe(
      'Account locked',
    )
  })

  it('falls back to generic copy when there is nothing usable', () => {
    expect(toAuthMessage(null)).toBe('Something went wrong. Please try again.')
    expect(toAuthMessage({ message: '   ' })).toBe(
      'Something went wrong. Please try again.',
    )
  })
})

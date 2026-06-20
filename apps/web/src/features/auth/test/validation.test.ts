import { describe, it, expect } from 'vitest'
import { validateEmail, validatePassword, validateRequired, validatePasswordMatch } from '@/features/auth/lib/validation'

describe('validation', () => {
  describe('validateEmail', () => {
    it('returns undefined for valid email', () => {
      expect(validateEmail('foo@bar.com')).toBeUndefined()
      expect(validateEmail('test@example.co.uk')).toBeUndefined()
    })

    it('returns error for invalid email', () => {
      expect(validateEmail('not-an-email')).toBe('Please enter a valid email address')
      expect(validateEmail('')).toBe('Please enter a valid email address')
      expect(validateEmail('@')).toBe('Please enter a valid email address')
    })
  })

  describe('validatePassword', () => {
    it('returns undefined for password of 8+ characters', () => {
      expect(validatePassword('longenough')).toBeUndefined()
      expect(validatePassword('abcdefgh')).toBeUndefined()
    })

    it('returns error for short password', () => {
      expect(validatePassword('short')).toBe('Password must be at least 8 characters')
      expect(validatePassword('')).toBe('Password must be at least 8 characters')
    })
  })

  describe('validateRequired', () => {
    it('returns undefined for non-empty value', () => {
      expect(validateRequired('x')).toBeUndefined()
      expect(validateRequired('hello')).toBeUndefined()
    })

    it('returns error for empty value', () => {
      expect(validateRequired('')).toBe('This field is required')
      expect(validateRequired('  ')).toBe('This field is required')
    })
  })

  describe('validatePasswordMatch', () => {
    it('returns undefined when passwords match', () => {
      expect(validatePasswordMatch('abc12345', 'abc12345')).toBeUndefined()
    })

    it('returns error when passwords do not match', () => {
      expect(validatePasswordMatch('abc12345', 'xyz98765')).toBe('Passwords do not match')
    })
  })
})

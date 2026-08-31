import { describe, expect, it } from 'vitest'
import { resolveDestination } from '@/features/auth/lib/destination'

describe('resolveDestination', () => {
  it('falls back to the dashboard when no destination was requested', () => {
    expect(resolveDestination('')).toBe('/dashboard')
  })

  it('returns the requested in-app route', () => {
    expect(resolveDestination('?next=%2Fprojects%2Fproj-1%2Frepository')).toBe(
      '/projects/proj-1/repository',
    )
  })

  it('refuses an absolute url so login cannot be turned into an open redirect', () => {
    expect(resolveDestination('?next=https%3A%2F%2Fevil.test%2Fsteal')).toBe(
      '/dashboard',
    )
  })

  it('refuses a protocol-relative url', () => {
    expect(resolveDestination('?next=%2F%2Fevil.test')).toBe('/dashboard')
  })
})

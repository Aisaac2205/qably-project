import { describe, expect, it } from 'vitest'
import { repositoryFileUrl } from '@/features/projects/suites/lib/repository-file-url'

describe('repositoryFileUrl', () => {
  it('builds a GitHub blob URL on the default branch from an owner/repo and a file path', () => {
    expect(repositoryFileUrl('acme/ecommerce-app', 'tests/checkout/empty-cart.spec.ts')).toBe(
      'https://github.com/acme/ecommerce-app/blob/HEAD/tests/checkout/empty-cart.spec.ts',
    )
  })

  it('encodes each path segment', () => {
    expect(repositoryFileUrl('acme/ecommerce-app', 'tests/checkout spec/a b.ts')).toBe(
      'https://github.com/acme/ecommerce-app/blob/HEAD/tests/checkout%20spec/a%20b.ts',
    )
  })

  it('returns null when githubRepo is undefined', () => {
    expect(repositoryFileUrl(undefined, 'tests/checkout/empty-cart.spec.ts')).toBeNull()
  })

  it('returns null when githubRepo is empty', () => {
    expect(repositoryFileUrl('', 'tests/checkout/empty-cart.spec.ts')).toBeNull()
  })

  it('returns null when filePath is undefined', () => {
    expect(repositoryFileUrl('acme/ecommerce-app', undefined)).toBeNull()
  })

  it('returns null when filePath is empty', () => {
    expect(repositoryFileUrl('acme/ecommerce-app', '')).toBeNull()
  })
})

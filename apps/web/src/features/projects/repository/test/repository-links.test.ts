import { describe, expect, it } from 'vitest'
import { deriveRepositoryLinks } from '../lib/repository-links'

describe('deriveRepositoryLinks', () => {
  it('derives a repo and commit URL from a matching GitHub blob evidence URI', () => {
    const links = deriveRepositoryLinks(
      'https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/tests/checkout/empty-cart.spec.ts',
      '8f3c2a1d4e5f',
    )

    expect(links).toEqual({
      repoUrl: 'https://github.com/acme/ecommerce-app',
      commitUrl: 'https://github.com/acme/ecommerce-app/commit/8f3c2a1d4e5f',
    })
  })

  it('stays inert when the evidence URI does not carry the same commit', () => {
    const links = deriveRepositoryLinks(
      'https://github.com/acme/ecommerce-app/blob/aaaaaaaaaaaa/tests/checkout/empty-cart.spec.ts',
      '8f3c2a1d4e5f',
    )

    expect(links).toEqual({ repoUrl: undefined, commitUrl: undefined })
  })

  it('stays inert for a non-GitHub evidence URI, such as Bitbucket, instead of guessing a scheme', () => {
    const links = deriveRepositoryLinks(
      'https://bitbucket.org/acme/api/src/8f3c2a1d4e5f/tests/checkout/empty-cart.spec.ts',
      '8f3c2a1d4e5f',
    )

    expect(links).toEqual({ repoUrl: undefined, commitUrl: undefined })
  })

  it('stays inert when there is no evidence or no commit yet', () => {
    expect(deriveRepositoryLinks(undefined, '8f3c2a1d4e5f')).toEqual({
      repoUrl: undefined,
      commitUrl: undefined,
    })
    expect(deriveRepositoryLinks('https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/a.ts', undefined)).toEqual({
      repoUrl: undefined,
      commitUrl: undefined,
    })
  })
})

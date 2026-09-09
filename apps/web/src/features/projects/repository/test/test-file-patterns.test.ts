import { describe, expect, it } from 'vitest'
import { matchDeclaredTestPattern } from '../lib/test-file-patterns'

const patterns = ['*.spec.ts', '*.test.ts']

describe('test file patterns', () => {
  it('matches declared spec and test suffixes only', () => {
    expect(matchDeclaredTestPattern('tests/cart.spec.ts', patterns)).toBe('*.spec.ts')
    expect(matchDeclaredTestPattern('tests/cart.test.ts', patterns)).toBe('*.test.ts')
    expect(matchDeclaredTestPattern('src/cart.ts', patterns)).toBeUndefined()
    expect(matchDeclaredTestPattern('docs/cart.spec.md', patterns)).toBeUndefined()
    expect(matchDeclaredTestPattern('src/cart.spec.tsx', patterns)).toBeUndefined()
  })

  it('normalizes Windows separators and returns the configured matching pattern', () => {
    expect(matchDeclaredTestPattern('tests\checkout\cart.test.ts', ['*.test.ts', '*.spec.ts'])).toBe('*.test.ts')
  })
})

describe('declared globs', () => {
  it('recognises a component test declared with its own extension', () => {
    expect(matchDeclaredTestPattern('src/ui/badge.test.tsx', ['*.test.tsx'])).toBe(
      '*.test.tsx',
    )
  })

  it('recognises the conventions of the frameworks the extraction prompt knows', () => {
    expect(matchDeclaredTestPattern('tests/test_cart.py', ['test_*.py'])).toBe(
      'test_*.py',
    )
    expect(
      matchDeclaredTestPattern('src/test/java/CartTest.java', ['*Test.java']),
    ).toBe('*Test.java')
    expect(matchDeclaredTestPattern('src/cart_test.cc', ['*_test.cc'])).toBe(
      '*_test.cc',
    )
  })

  it('crosses any number of directories with a globstar', () => {
    expect(
      matchDeclaredTestPattern('src/a/b/cart.spec.ts', ['**/*.spec.ts']),
    ).toBe('**/*.spec.ts')
    expect(matchDeclaredTestPattern('cart.spec.ts', ['**/*.spec.ts'])).toBe(
      '**/*.spec.ts',
    )
  })

  it('anchors a pattern that names a directory', () => {
    expect(
      matchDeclaredTestPattern('apps/api/test/health.e2e-spec.ts', [
        'apps/api/test/**',
      ]),
    ).toBe('apps/api/test/**')
    expect(
      matchDeclaredTestPattern('apps/web/src/cart.spec.ts', ['apps/api/**']),
    ).toBeUndefined()
  })

  it('keeps a single star inside one path segment', () => {
    expect(
      matchDeclaredTestPattern('src/a/b/cart.spec.ts', ['src/*.spec.ts']),
    ).toBeUndefined()
  })

  it('matches exactly one character with a question mark', () => {
    expect(matchDeclaredTestPattern('src/a1.spec.ts', ['a?.spec.ts'])).toBe(
      'a?.spec.ts',
    )
    expect(
      matchDeclaredTestPattern('src/a12.spec.ts', ['a?.spec.ts']),
    ).toBeUndefined()
  })

  it('never lets a literal dot match an arbitrary character', () => {
    expect(
      matchDeclaredTestPattern('src/cartXspec.ts', ['*.spec.ts']),
    ).toBeUndefined()
  })

  it('returns the first declared pattern that matches', () => {
    expect(
      matchDeclaredTestPattern('src/cart.spec.ts', ['*.test.ts', '*.spec.ts']),
    ).toBe('*.spec.ts')
  })
})

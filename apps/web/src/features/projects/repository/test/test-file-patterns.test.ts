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

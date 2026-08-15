import { describe, expect, it } from 'vitest'
import type { CodeChange } from '@qably/types'
import { matchDeclaredTestPattern, selectDetectedTestChanges } from '../lib/test-file-patterns'

const patterns = ['*.spec.ts', '*.test.ts']

function createChange(filePath: string): CodeChange {
  return {
    id: filePath,
    projectId: 'proj-1',
    commitSha: '8f3c2a1d4e5f',
    filePath,
    diff: '',
    evidenceId: `evidence-${filePath}`,
  }
}

describe('test file patterns', () => {
  it('matches declared spec and test suffixes only', () => {
    expect(matchDeclaredTestPattern('tests/cart.spec.ts', patterns)).toBe('*.spec.ts')
    expect(matchDeclaredTestPattern('tests/cart.test.ts', patterns)).toBe('*.test.ts')
    expect(matchDeclaredTestPattern('src/cart.ts', patterns)).toBeUndefined()
    expect(matchDeclaredTestPattern('docs/cart.spec.md', patterns)).toBeUndefined()
    expect(matchDeclaredTestPattern('src/cart.spec.tsx', patterns)).toBeUndefined()
  })

  it('normalizes Windows separators and returns the configured matching pattern', () => {
    expect(matchDeclaredTestPattern('tests\\checkout\\cart.test.ts', ['*.test.ts', '*.spec.ts'])).toBe('*.test.ts')
  })

  it('projects detected changes without mutating raw records', () => {
    const source = createChange('src/cart.ts')
    const spec = createChange('tests/cart.spec.ts')
    const test = createChange('tests/cart.test.ts')
    const changes = [source, spec, test]

    expect(selectDetectedTestChanges(changes, patterns)).toEqual([
      { ...spec, detectedPattern: '*.spec.ts' },
      { ...test, detectedPattern: '*.test.ts' },
    ])
    expect(spec).not.toHaveProperty('detectedPattern')
    expect(test).not.toHaveProperty('detectedPattern')
  })
})

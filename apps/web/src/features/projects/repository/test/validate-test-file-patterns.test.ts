import { describe, expect, it } from 'vitest'
import {
  MAX_TEST_FILE_PATTERNS,
  validateTestFilePatterns,
} from '../lib/validate-test-file-patterns'

describe('validateTestFilePatterns', () => {
  it('trims each pattern and drops the empty rows an editor leaves behind', () => {
    expect(validateTestFilePatterns(['  *.spec.ts  ', '', '   '])).toEqual({
      patterns: ['*.spec.ts'],
      issue: null,
    })
  })

  it('accepts the conventions of the frameworks the extractor knows', () => {
    const result = validateTestFilePatterns([
      '**/*.test.tsx',
      'test_*.py',
      '*Test.java',
      'apps/api/test/**',
    ])

    expect(result.issue).toBeNull()
    expect(result.patterns).toHaveLength(4)
  })

  it('refuses a list that ends up empty', () => {
    expect(validateTestFilePatterns(['  ']).issue).toBe('no-patterns')
  })

  it('refuses a pattern made only of wildcards', () => {
    expect(validateTestFilePatterns(['**']).issue).toBe('wildcard-only')
    expect(validateTestFilePatterns(['*.spec.ts', '**/*']).issue).toBe(
      'wildcard-only',
    )
  })

  it('refuses a pattern longer than the server accepts', () => {
    expect(validateTestFilePatterns([`${'a'.repeat(121)}.ts`]).issue).toBe(
      'too-long',
    )
  })

  it('refuses more patterns than the server accepts', () => {
    const many = Array.from(
      { length: MAX_TEST_FILE_PATTERNS + 1 },
      (_, index) => `*.spec${index}.ts`,
    )

    expect(validateTestFilePatterns(many).issue).toBe('too-many')
  })
})

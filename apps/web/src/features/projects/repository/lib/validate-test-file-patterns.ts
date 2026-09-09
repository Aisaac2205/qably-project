export const MAX_TEST_FILE_PATTERNS = 20
export const MAX_TEST_FILE_PATTERN_LENGTH = 120

export type TestFilePatternIssue =
  | 'no-patterns'
  | 'too-many'
  | 'too-long'
  | 'wildcard-only'

export interface TestFilePatternValidation {
  patterns: string[]
  issue: TestFilePatternIssue | null
}

const HAS_LITERAL = /[^*?/]/

export function validateTestFilePatterns(
  values: readonly string[],
): TestFilePatternValidation {
  const patterns = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (patterns.length === 0) return { patterns, issue: 'no-patterns' }
  if (patterns.length > MAX_TEST_FILE_PATTERNS) {
    return { patterns, issue: 'too-many' }
  }
  if (patterns.some((value) => value.length > MAX_TEST_FILE_PATTERN_LENGTH)) {
    return { patterns, issue: 'too-long' }
  }
  if (patterns.some((value) => !HAS_LITERAL.test(value))) {
    return { patterns, issue: 'wildcard-only' }
  }

  return { patterns, issue: null }
}

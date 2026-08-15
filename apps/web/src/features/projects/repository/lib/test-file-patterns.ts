import type { CodeChange } from '@qably/types'

const declaredSuffixes: Record<string, string> = {
  '*.spec.ts': '.spec.ts',
  '*.test.ts': '.test.ts',
}

export function matchDeclaredTestPattern(filePath: string, patterns: readonly string[]): string | undefined {
  const normalizedPath = filePath.replaceAll('\\', '/')

  return patterns.find((pattern) => {
    const suffix = declaredSuffixes[pattern]
    return suffix !== undefined && normalizedPath.endsWith(suffix)
  })
}

export function selectDetectedTestChanges(
  changes: readonly CodeChange[],
  patterns: readonly string[],
): Array<CodeChange & { detectedPattern: string }> {
  return changes.flatMap((change) => {
    const detectedPattern = matchDeclaredTestPattern(change.filePath, patterns)
    return detectedPattern ? [{ ...change, detectedPattern }] : []
  })
}

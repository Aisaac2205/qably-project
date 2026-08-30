import type { CodeChange } from '@qably/types'
import { matchDeclaredTestPattern } from '@qably/types'

export { matchDeclaredTestPattern }

export function selectDetectedTestChanges(
  changes: readonly CodeChange[],
  patterns: readonly string[],
): Array<CodeChange & { detectedPattern: string }> {
  return changes.flatMap((change) => {
    const detectedPattern = matchDeclaredTestPattern(change.filePath, patterns)
    return detectedPattern ? [{ ...change, detectedPattern }] : []
  })
}

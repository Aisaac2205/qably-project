import type { SuiteSortKey, SuiteSummarySort } from '@qably/types'

const CURSOR_PREFIX = 'stub-cursor:'

export function encodeCursor(key: SuiteSortKey): string {
  return `${CURSOR_PREFIX}${JSON.stringify(key)}`
}

export function decodeCursor(cursor: string, sort: SuiteSummarySort): SuiteSortKey {
  const invalid = new Error('Invalid suite summaries cursor')

  if (!cursor.startsWith(CURSOR_PREFIX)) throw invalid

  let parsed: unknown

  try {
    parsed = JSON.parse(cursor.slice(CURSOR_PREFIX.length))
  } catch {
    throw invalid
  }

  if (typeof parsed !== 'object' || parsed === null) throw invalid

  const key = parsed as Partial<SuiteSortKey>

  if (key.sort !== sort || typeof key.id !== 'string') throw invalid

  return key as SuiteSortKey
}

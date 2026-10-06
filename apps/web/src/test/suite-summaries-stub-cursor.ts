import type { SuiteSortKey, SuiteSummarySort } from '@qably/types'

const CURSOR_PREFIX = 'stub-cursor:'
const MAX_PASS_RATE = 100

function isCanonicalIso(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function isPassRate(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= MAX_PASS_RATE)
  )
}

function isCaseCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function toKey(sort: SuiteSummarySort, fields: Record<string, unknown>): SuiteSortKey | null {
  const { id, createdAt } = fields

  if (fields.sort !== sort || typeof id !== 'string' || id === '') return null

  switch (sort) {
    case 'recent':
      return isCanonicalIso(createdAt) ? { sort, createdAt, id } : null
    case 'name':
      return typeof fields.name === 'string' ? { sort, name: fields.name, id } : null
    case 'pass-rate':
      return isPassRate(fields.recentPassRate) && isCanonicalIso(createdAt)
        ? { sort, recentPassRate: fields.recentPassRate, createdAt, id }
        : null
    case 'cases':
      return isCaseCount(fields.caseCount) && isCanonicalIso(createdAt)
        ? { sort, caseCount: fields.caseCount, createdAt, id }
        : null
  }
}

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

  const key = toKey(sort, parsed as Record<string, unknown>)

  if (key === null) throw invalid

  return key
}

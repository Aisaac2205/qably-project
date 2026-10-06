import { SUITE_RUN_STATUSES, SUITE_SUMMARY_SORTS, type SuiteSortKey } from '@qably/types'
import { ApiError } from '@/lib/api-client'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { decodeCursor } from './suite-summaries-stub-cursor'

const DEFAULT_LIMIT = 50
const MIN_LIMIT = 1
const MAX_LIMIT = 100
const MAX_SEARCH_LENGTH = 200
const MAX_TAG_LENGTH = 40
const MAX_CURSOR_LENGTH = 2048
const CURSOR_POSITION_MESSAGE =
  'cursor must be a valid opaque suite summaries cursor for the requested sort'

interface ValidationIssue {
  path: string
  message: string
}

export interface ValidatedSuiteSummariesRequest {
  limit: number
  cursor: SuiteSortKey | undefined
}

function isBetween(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function fieldIssues({
  projectId,
  limit,
  sort,
  search,
  tag,
  status,
  cursor,
}: ListSuiteSummariesParams): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (projectId.length < 1) {
    issues.push({ path: 'projectId', message: 'projectId must not be empty' })
  }

  if (limit !== undefined && !(Number.isInteger(limit) && isBetween(limit, MIN_LIMIT, MAX_LIMIT))) {
    issues.push({
      path: 'limit',
      message: `limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`,
    })
  }

  if (!SUITE_SUMMARY_SORTS.includes(sort)) {
    issues.push({ path: 'sort', message: `sort must be one of ${SUITE_SUMMARY_SORTS.join(', ')}` })
  }

  if (search !== undefined && !isBetween(search.trim().length, 1, MAX_SEARCH_LENGTH)) {
    issues.push({
      path: 'search',
      message: `search must have between 1 and ${MAX_SEARCH_LENGTH} characters once trimmed`,
    })
  }

  if (tag !== undefined && !isBetween(tag.length, 1, MAX_TAG_LENGTH)) {
    issues.push({
      path: 'tag',
      message: `tag must have between 1 and ${MAX_TAG_LENGTH} characters`,
    })
  }

  if (status !== undefined && !SUITE_RUN_STATUSES.includes(status)) {
    issues.push({ path: 'status', message: `status must be one of ${SUITE_RUN_STATUSES.join(', ')}` })
  }

  if (cursor !== undefined && !isBetween(cursor.length, 1, MAX_CURSOR_LENGTH)) {
    issues.push({
      path: 'cursor',
      message: `cursor must have between 1 and ${MAX_CURSOR_LENGTH} characters`,
    })
  }

  return issues
}

export function validateSuiteSummariesRequest(
  params: ListSuiteSummariesParams,
): ValidatedSuiteSummariesRequest {
  const issues = fieldIssues(params)
  const position =
    issues.length === 0 && params.cursor !== undefined
      ? decodeCursor(params.cursor, params.sort)
      : undefined

  if (position === null) {
    issues.push({ path: 'cursor', message: CURSOR_POSITION_MESSAGE })
  }

  if (issues.length > 0) {
    throw new ApiError(400, 'Validation failed', undefined, { issues })
  }

  return { limit: params.limit ?? DEFAULT_LIMIT, cursor: position ?? undefined }
}

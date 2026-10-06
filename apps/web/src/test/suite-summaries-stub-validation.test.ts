import { describe, expect, it } from 'vitest'
import {
  SUITE_RUN_STATUSES,
  type SuiteRunStatus,
  type SuiteSortKey,
  type SuiteSummarySort,
} from '@qably/types'
import { ApiError } from '@/lib/api-client'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { encodeCursor } from '@/test/suite-summaries-stub-cursor'
import { validateSuiteSummariesRequest } from '@/test/suite-summaries-stub-validation'
import { PROJECT } from '@/test/suite-summaries-fixtures'

interface Issue {
  path: string
  message: string
}

const CURSOR_ISSUE_MESSAGE =
  'cursor must be a valid opaque suite summaries cursor for the requested sort'

const RECENT_KEY = {
  sort: 'recent',
  createdAt: '2026-01-02T03:04:05.678Z',
  id: 's1',
} satisfies SuiteSortKey

function validate(overrides: Partial<ListSuiteSummariesParams> = {}) {
  return validateSuiteSummariesRequest({ projectId: PROJECT, sort: 'recent', ...overrides })
}

function failureOf(overrides: Partial<ListSuiteSummariesParams>): ApiError {
  try {
    validate(overrides)
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }

  throw new Error('the request was accepted')
}

function issuesOf(overrides: Partial<ListSuiteSummariesParams>): Issue[] {
  const issues = failureOf(overrides).details?.issues

  return Array.isArray(issues) ? (issues as Issue[]) : []
}

function pathsOf(overrides: Partial<ListSuiteSummariesParams>): string[] {
  return issuesOf(overrides).map((issue) => issue.path)
}

describe('validateSuiteSummariesRequest', () => {
  describe('accepted requests', () => {
    it('defaults the limit to fifty and has no cursor position', () => {
      expect(validate()).toStrictEqual({ limit: 50, cursor: undefined })
    })

    it.each([1, 37, 100])('keeps the limit %s', (limit) => {
      expect(validate({ limit }).limit).toBe(limit)
    })

    it('decodes a cursor issued for the same sort into its position', () => {
      expect(validate({ cursor: encodeCursor(RECENT_KEY) }).cursor).toStrictEqual(RECENT_KEY)
    })

    it('measures the search after it is trimmed, like the API', () => {
      expect(() => validate({ search: `  ${'a'.repeat(200)}  ` })).not.toThrow()
    })

    it('accepts a tag of 40 characters and a cursor-free search', () => {
      expect(() => validate({ tag: 't'.repeat(40), search: 'auth' })).not.toThrow()
    })

    it.each(SUITE_RUN_STATUSES)('accepts the status %s', (status) => {
      expect(() => validate({ status })).not.toThrow()
    })
  })

  describe('the rejection', () => {
    it('is the 400 the API answers, with the validation envelope and no code', () => {
      const failure = failureOf({ limit: 0 })

      expect(failure.status).toBe(400)
      expect(failure.message).toBe('Validation failed')
      expect(failure.code).toBeUndefined()
      expect(Object.keys(failure.details ?? {})).toEqual(['issues'])
    })

    it('gives each issue a string path and a message', () => {
      const issues = issuesOf({ limit: 0, search: '', tag: '' })

      expect(issues).toHaveLength(3)
      for (const issue of issues) {
        expect(Object.keys(issue).sort()).toEqual(['message', 'path'])
        expect(typeof issue.path).toBe('string')
        expect(issue.message.length).toBeGreaterThan(0)
      }
    })

    it('reports every invalid field together, in the order of the API schema', () => {
      expect(
        pathsOf({
          projectId: '',
          limit: 0,
          sort: 'oldest' as SuiteSummarySort,
          search: '',
          tag: '',
          status: 'done' as SuiteRunStatus,
          cursor: '',
        }),
      ).toEqual(['projectId', 'limit', 'sort', 'search', 'tag', 'status', 'cursor'])
    })
  })

  describe('rejected fields', () => {
    it('rejects an empty project id', () => {
      expect(pathsOf({ projectId: '' })).toEqual(['projectId'])
    })

    it.each([0, 101, 1.5, -1])('rejects the limit %s', (limit) => {
      expect(pathsOf({ limit })).toEqual(['limit'])
    })

    it('rejects a sort the API does not know', () => {
      expect(pathsOf({ sort: 'oldest' as SuiteSummarySort })).toEqual(['sort'])
    })

    it.each([
      ['an empty search', ''],
      ['a search of only whitespace', '   '],
      ['a search of 201 characters', 'a'.repeat(201)],
    ])('rejects %s', (_label, search) => {
      expect(pathsOf({ search })).toEqual(['search'])
    })

    it.each([
      ['an empty tag', ''],
      ['a tag of 41 characters', 't'.repeat(41)],
    ])('rejects %s', (_label, tag) => {
      expect(pathsOf({ tag })).toEqual(['tag'])
    })

    it.each(['all', 'done', ''])('rejects the status %j', (status) => {
      expect(pathsOf({ status: status as SuiteRunStatus })).toEqual(['status'])
    })
  })

  describe('rejected cursors', () => {
    it('rejects an empty cursor', () => {
      expect(pathsOf({ cursor: '' })).toEqual(['cursor'])
    })

    it('rejects a cursor of 2049 characters', () => {
      expect(pathsOf({ cursor: 'c'.repeat(2049) })).toEqual(['cursor'])
    })

    it('reads a cursor of exactly 2048 characters as an undecodable position', () => {
      expect(issuesOf({ cursor: 'c'.repeat(2048) })).toStrictEqual([
        { path: 'cursor', message: CURSOR_ISSUE_MESSAGE },
      ])
    })

    it('rejects a cursor the stub did not issue', () => {
      expect(issuesOf({ cursor: 'not-a-cursor' })).toStrictEqual([
        { path: 'cursor', message: CURSOR_ISSUE_MESSAGE },
      ])
    })

    it('rejects a cursor issued for another sort', () => {
      expect(issuesOf({ sort: 'name', cursor: encodeCursor(RECENT_KEY) })).toStrictEqual([
        { path: 'cursor', message: CURSOR_ISSUE_MESSAGE },
      ])
    })

    it('does not read the cursor while another field is invalid', () => {
      expect(pathsOf({ limit: 0, cursor: 'not-a-cursor' })).toEqual(['limit'])
    })
  })
})

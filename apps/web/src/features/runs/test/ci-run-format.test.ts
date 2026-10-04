import { describe, expect, it } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import { ciRunMetaParts, ciRunTitle } from '@/features/runs/lib/ci-run-format'

const SECOND = 1000
const MINUTE = 60 * SECOND
const START = Date.parse('2026-10-03T10:00:00.000Z')

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function ciRun(overrides: Partial<CiRunSummaryRecord> = {}): CiRunSummaryRecord {
  return {
    id: 'c1',
    projectId: 'proj-1',
    source: 'github_actions',
    externalId: '900',
    status: 'passing',
    startedAt: iso(START),
    lastReportedAt: iso(START + 5 * MINUTE),
    ...overrides,
  }
}

describe('ciRunTitle', () => {
  it('uses the first line of the commit message', () => {
    expect(
      ciRunTitle(
        ciRun({
          commitMessage: 'fix: checkout total\n\nThe tax was applied twice.',
          workflowName: 'CI',
          commitSha: 'abcdef1234567890',
        }),
      ),
    ).toBe('fix: checkout total')
  })

  it('reads the first line of a Windows-style message without the carriage return', () => {
    expect(ciRunTitle(ciRun({ commitMessage: 'fix: checkout total\r\n\r\nBody' }))).toBe(
      'fix: checkout total',
    )
  })

  it('skips leading blank lines and trims the line it picks', () => {
    expect(ciRunTitle(ciRun({ commitMessage: '\n  feat: add export  \nBody' }))).toBe(
      'feat: add export',
    )
  })

  it('falls back to the workflow name when there is no commit message', () => {
    expect(ciRunTitle(ciRun({ workflowName: 'CI', commitSha: 'abcdef1234567890' }))).toBe('CI')
  })

  it.each([['empty', ''], ['whitespace and newlines', '  \n \n']])(
    'falls back to the workflow name when the commit message is %s',
    (_label, commitMessage) => {
      expect(ciRunTitle(ciRun({ commitMessage, workflowName: 'CI' }))).toBe('CI')
    },
  )

  it('falls back to the 7-character SHA when there is no workflow name', () => {
    expect(ciRunTitle(ciRun({ commitSha: 'abcdef1234567890' }))).toBe('abcdef1')
  })

  it('falls back to the external id when nothing else is present', () => {
    expect(ciRunTitle(ciRun({ externalId: '12345' }))).toBe('12345')
  })

  it('titles a backfilled CI run, which carries only commit fields', () => {
    expect(
      ciRunTitle(
        ciRun({
          commitMessage: 'chore: bump deps',
          commitSha: '1234567abcdef',
          commitAuthor: 'Ana',
        }),
      ),
    ).toBe('chore: bump deps')
    expect(ciRunTitle(ciRun({ commitSha: '1234567abcdef', commitAuthor: 'Ana' }))).toBe('1234567')
  })
})

describe('ciRunMetaParts', () => {
  it('lists the number, the ref, the short SHA and the author in that order', () => {
    expect(
      ciRunMetaParts(
        ciRun({
          runNumber: 42,
          branch: 'main',
          commitSha: 'abcdef1234567890',
          commitAuthor: 'Ana',
        }),
      ),
    ).toStrictEqual([
      { kind: 'number', number: 42 },
      { kind: 'ref', value: 'main' },
      { kind: 'sha', value: 'abcdef1' },
      { kind: 'author', value: 'Ana' },
    ])
  })

  it('prefers the head ref over the branch, which is the merge ref on a pull request', () => {
    expect(ciRunMetaParts(ciRun({ branch: '12/merge', headRef: 'feature/export' }))).toStrictEqual([
      { kind: 'ref', value: 'feature/export' },
    ])
  })

  it('uses the branch when there is no head ref', () => {
    expect(ciRunMetaParts(ciRun({ branch: 'main' }))).toStrictEqual([
      { kind: 'ref', value: 'main' },
    ])
  })

  it('omits what is absent and keeps the order of what remains', () => {
    expect(ciRunMetaParts(ciRun({ runNumber: 7, commitAuthor: 'Ana' }))).toStrictEqual([
      { kind: 'number', number: 7 },
      { kind: 'author', value: 'Ana' },
    ])
    expect(ciRunMetaParts(ciRun({ branch: 'main', commitSha: 'abcdef1234567890' }))).toStrictEqual([
      { kind: 'ref', value: 'main' },
      { kind: 'sha', value: 'abcdef1' },
    ])
  })

  it('lists only the SHA and the author for a backfilled CI run', () => {
    expect(
      ciRunMetaParts(
        ciRun({ commitMessage: 'chore: bump deps', commitSha: '1234567abcdef', commitAuthor: 'Ana' }),
      ),
    ).toStrictEqual([
      { kind: 'sha', value: '1234567' },
      { kind: 'author', value: 'Ana' },
    ])
  })

  it('omits blank strings instead of rendering an empty part', () => {
    expect(
      ciRunMetaParts(ciRun({ branch: '', headRef: '   ', commitSha: '', commitAuthor: ' ' })),
    ).toStrictEqual([])
    expect(ciRunMetaParts(ciRun({ headRef: '  ', branch: 'main' }))).toStrictEqual([
      { kind: 'ref', value: 'main' },
    ])
  })

  it('returns no parts when the CI run carries no metadata', () => {
    expect(ciRunMetaParts(ciRun())).toStrictEqual([])
  })
})

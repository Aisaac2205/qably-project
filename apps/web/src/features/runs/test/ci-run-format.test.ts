import { afterEach, describe, expect, it } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import {
  approxDuration,
  ciRunMetaParts,
  ciRunTitle,
  freshness,
  type DurationPart,
  type FreshnessPart,
} from '@/features/runs/lib/ci-run-format'
import { humanizeJobKey } from '@/features/runs/lib/ci-run-groups'
import { useI18nStore } from '@/lib/i18n/store'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
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

function duration(elapsedMs: number): DurationPart[] | undefined {
  return approxDuration(iso(START), iso(START + elapsedMs))
}

function freshnessAfter(elapsedMs: number): FreshnessPart {
  return freshness(iso(START), START + elapsedMs)
}

function translate(part: { key: string; count: number }): string {
  return useI18nStore.getState().t(part.key, { count: part.count })
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

describe('approxDuration', () => {
  it.each<[string, number]>([
    ['0.4 s', 400],
    ['0 s', 0],
    ['999 ms', 999],
  ])('omits a duration of %s', (_label, elapsed) => {
    expect(duration(elapsed)).toBeUndefined()
  })

  it('omits a duration that runs backwards', () => {
    expect(approxDuration(iso(START), iso(START - 5 * MINUTE))).toBeUndefined()
  })

  it.each<[string, number, DurationPart[]]>([
    ['1 s', SECOND, [{ key: 'runs.ci.durationSeconds', count: 1 }]],
    ['1.9 s', 1_900, [{ key: 'runs.ci.durationSeconds', count: 1 }]],
    ['45 s', 45 * SECOND, [{ key: 'runs.ci.durationSeconds', count: 45 }]],
    ['59 s', 59 * SECOND, [{ key: 'runs.ci.durationSeconds', count: 59 }]],
    ['60 s', MINUTE, [{ key: 'runs.ci.durationMinutes', count: 1 }]],
    ['12 min 20 s', 12 * MINUTE + 20 * SECOND, [{ key: 'runs.ci.durationMinutes', count: 12 }]],
    ['59 min 59 s', 59 * MINUTE + 59 * SECOND, [{ key: 'runs.ci.durationMinutes', count: 59 }]],
    [
      '65 min',
      65 * MINUTE,
      [
        { key: 'runs.ci.durationHours', count: 1 },
        { key: 'runs.ci.durationMinutes', count: 5 },
      ],
    ],
    ['120 min', 120 * MINUTE, [{ key: 'runs.ci.durationHours', count: 2 }]],
    ['3 h 0 min 30 s', 3 * HOUR + 30 * SECOND, [{ key: 'runs.ci.durationHours', count: 3 }]],
    [
      '1 h 59 min 59 s',
      HOUR + 59 * MINUTE + 59 * SECOND,
      [
        { key: 'runs.ci.durationHours', count: 1 },
        { key: 'runs.ci.durationMinutes', count: 59 },
      ],
    ],
    ['30 h', 30 * HOUR, [{ key: 'runs.ci.durationHours', count: 30 }]],
  ])('splits %s into ordered unit parts', (_label, elapsed, expected) => {
    expect(duration(elapsed)).toStrictEqual(expected)
  })

  it('reads the real startedAt and lastReportedAt of a CI run', () => {
    const run = ciRun({
      startedAt: '2026-10-03T10:00:00.000Z',
      lastReportedAt: '2026-10-03T11:05:00.000Z',
    })

    expect(approxDuration(run.startedAt, run.lastReportedAt)).toStrictEqual([
      { key: 'runs.ci.durationHours', count: 1 },
      { key: 'runs.ci.durationMinutes', count: 5 },
    ])
  })
})

describe('freshness', () => {
  it.each<[string, number, FreshnessPart]>([
    ['0 s', 0, { key: 'runs.ci.freshnessSeconds', count: 0 }],
    ['12 s', 12 * SECOND, { key: 'runs.ci.freshnessSeconds', count: 12 }],
    ['12.9 s', 12_900, { key: 'runs.ci.freshnessSeconds', count: 12 }],
    ['59 s', 59 * SECOND, { key: 'runs.ci.freshnessSeconds', count: 59 }],
    ['60 s', 60 * SECOND, { key: 'runs.ci.freshnessMinutes', count: 1 }],
    ['119 s', 119 * SECOND, { key: 'runs.ci.freshnessMinutes', count: 1 }],
    ['59 min 59 s', HOUR - SECOND, { key: 'runs.ci.freshnessMinutes', count: 59 }],
    ['3600 s', HOUR, { key: 'runs.ci.freshnessHours', count: 1 }],
    ['23 h 59 min 59 s', DAY - SECOND, { key: 'runs.ci.freshnessHours', count: 23 }],
    ['86400 s', DAY, { key: 'runs.ci.freshnessDays', count: 1 }],
    ['3 days', 3 * DAY + 5 * HOUR, { key: 'runs.ci.freshnessDays', count: 3 }],
  ])('picks the unit and the count for %s', (_label, elapsed, expected) => {
    expect(freshnessAfter(elapsed)).toStrictEqual(expected)
  })

  it('clamps a negative difference to 0 s', () => {
    expect(freshnessAfter(-30 * SECOND)).toStrictEqual({
      key: 'runs.ci.freshnessSeconds',
      count: 0,
    })
    expect(freshnessAfter(-3 * DAY)).toStrictEqual({ key: 'runs.ci.freshnessSeconds', count: 0 })
  })

  it('follows the clock while the report timestamp stays put', () => {
    const lastReportedAt = iso(START)

    expect(freshness(lastReportedAt, START + 10 * SECOND).count).toBe(10)
    expect(freshness(lastReportedAt, START + 20 * SECOND).count).toBe(20)
  })
})

describe('humanizeJobKey', () => {
  it.each<[string, string]>([
    ['build-and-test', 'build and test'],
    ['build_and_test', 'build and test'],
    ['unit_tests-node', 'unit tests node'],
    ['Build-API', 'Build API'],
    ['api', 'api'],
  ])('turns the separators of %s into spaces', (key, expected) => {
    expect(humanizeJobKey(key)).toBe(expected)
  })

  it.each<[string]>([['test (node 20)'], ['test.unit'], ['lint: web']])(
    'leaves %s intact because it has no - or _',
    (key) => {
      expect(humanizeJobKey(key)).toBe(key)
    },
  )
})

describe('formatters together with the real copy', () => {
  afterEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  function approxLabel(parts: readonly DurationPart[]): string {
    const { t } = useI18nStore.getState()
    return t('runs.ci.durationApprox', { value: parts.map(translate).join(' ') })
  }

  it.each<[string, number, string]>([
    ['45 s', 45 * SECOND, '~45 s'],
    ['12 min 20 s', 12 * MINUTE + 20 * SECOND, '~12 min'],
    ['65 min', 65 * MINUTE, '~1 h 5 min'],
    ['120 min', 120 * MINUTE, '~2 h'],
  ])('reads %s as %s', (_label, elapsed, expected) => {
    const parts = duration(elapsed)

    expect(parts).toBeDefined()
    expect(approxLabel(parts ?? [])).toBe(expected)
  })

  it.each<[string, number, string, string]>([
    ['seconds', 12 * SECOND, 'Last report 12 s ago', 'Último reporte hace 12 s'],
    ['minutes', 5 * MINUTE, 'Last report 5 min ago', 'Último reporte hace 5 min'],
    ['hours', 2 * HOUR, 'Last report 2 h ago', 'Último reporte hace 2 h'],
    ['days', 3 * DAY, 'Last report 3 d ago', 'Último reporte hace 3 d'],
  ])('has a translation for every freshness unit (%s) in both locales', (_unit, elapsed, en, es) => {
    const part = freshnessAfter(elapsed)

    useI18nStore.setState({ locale: 'en' })
    expect(translate(part)).toBe(en)
    useI18nStore.setState({ locale: 'es' })
    expect(translate(part)).toBe(es)
  })
})

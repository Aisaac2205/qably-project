import { describe, expect, it } from 'vitest'
import type { CiRunJobRunRecord, RunStatus } from '@qably/types'
import {
  groupRunsByJob,
  reportLabel,
  reportLabelsByRun,
} from '@/features/runs/lib/ci-run-groups'

function run(id: string, overrides: Partial<CiRunJobRunRecord> = {}): CiRunJobRunRecord {
  return {
    id,
    suiteId: `suite-${id}`,
    suiteName: `Suite ${id}`,
    name: `Suite ${id}`,
    status: 'pass',
    startedAt: '2026-10-03T10:00:00.000Z',
    ...overrides,
  }
}

function inJob(
  id: string,
  ciJobKey: string | undefined,
  status: RunStatus = 'pass',
): CiRunJobRunRecord {
  return run(id, { ciJobKey, status })
}

function ids(runs: readonly CiRunJobRunRecord[]): string[] {
  return runs.map((item) => item.id)
}

function keys(groups: readonly { key: string }[]): string[] {
  return groups.map((group) => group.key)
}

describe('groupRunsByJob', () => {
  it('groups the runs by their job key', () => {
    const result = groupRunsByJob([
      inJob('r1', 'api'),
      inJob('r2', 'web'),
      inJob('r3', 'api'),
    ])

    expect(result.unnamed).toStrictEqual([])
    expect(keys(result.groups)).toStrictEqual(['api', 'web'])
    expect(ids(result.groups[0].runs)).toStrictEqual(['r1', 'r3'])
    expect(ids(result.groups[1].runs)).toStrictEqual(['r2'])
  })

  it('puts the jobs with failures first and then sorts by key', () => {
    const result = groupRunsByJob([
      inJob('w1', 'web'),
      inJob('a1', 'api'),
      inJob('a2', 'api', 'fail'),
      inJob('l1', 'landing'),
    ])

    expect(keys(result.groups)).toStrictEqual(['api', 'landing', 'web'])
  })

  it('sorts the failing jobs by key among themselves, ahead of the passing ones', () => {
    const result = groupRunsByJob([
      inJob('l1', 'landing'),
      inJob('w1', 'web', 'fail'),
      inJob('d1', 'docs'),
      inJob('a1', 'api', 'fail'),
    ])

    expect(keys(result.groups)).toStrictEqual(['api', 'web', 'docs', 'landing'])
  })

  it('does not rank a job ahead for runs that are still running or pending', () => {
    const result = groupRunsByJob([
      inJob('w1', 'web', 'pending'),
      inJob('l1', 'landing', 'running'),
      inJob('a1', 'api'),
    ])

    expect(keys(result.groups)).toStrictEqual(['api', 'landing', 'web'])
  })

  it('ranks a job ahead as soon as one of its runs fails', () => {
    const result = groupRunsByJob([
      inJob('a1', 'api'),
      inJob('a2', 'api'),
      inJob('w1', 'web'),
      inJob('w2', 'web', 'fail'),
      inJob('w3', 'web'),
    ])

    expect(keys(result.groups)).toStrictEqual(['web', 'api'])
  })

  it('sorts keys without regard to case and with numbers in numeric order', () => {
    const result = groupRunsByJob([
      inJob('r1', 'Zeta'),
      inJob('r2', 'alpha'),
      inJob('r3', 'node 20'),
      inJob('r4', 'node 9'),
    ])

    expect(keys(result.groups)).toStrictEqual(['alpha', 'node 9', 'node 20', 'Zeta'])
  })

  it('keeps keys that differ only by case as separate groups in the order they first appear', () => {
    const lowerFirst = groupRunsByJob([inJob('r1', 'api'), inJob('r2', 'API')])
    const upperFirst = groupRunsByJob([inJob('r1', 'API'), inJob('r2', 'api')])

    expect(keys(lowerFirst.groups)).toStrictEqual(['api', 'API'])
    expect(ids(lowerFirst.groups[0].runs)).toStrictEqual(['r1'])
    expect(ids(lowerFirst.groups[1].runs)).toStrictEqual(['r2'])
    expect(keys(upperFirst.groups)).toStrictEqual(['API', 'api'])
    expect(ids(upperFirst.groups[0].runs)).toStrictEqual(['r1'])
    expect(ids(upperFirst.groups[1].runs)).toStrictEqual(['r2'])
  })

  it('does not let a key that differs only by case jump ahead of its neighbours', () => {
    const result = groupRunsByJob([inJob('r1', 'Node'), inJob('r2', 'alpha'), inJob('r3', 'node')])

    expect(keys(result.groups)).toStrictEqual(['alpha', 'Node', 'node'])
  })

  it('lists the runs without a job key as the unnamed section, in their original order', () => {
    const result = groupRunsByJob([
      inJob('u1', undefined),
      inJob('a1', 'api'),
      inJob('u2', undefined),
    ])

    expect(ids(result.unnamed)).toStrictEqual(['u1', 'u2'])
    expect(keys(result.groups)).toStrictEqual(['api'])
    expect(ids(result.groups[0].runs)).toStrictEqual(['a1'])
  })

  it.each<[string, string | undefined]>([
    ['absent', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('treats a job key that is %s as no job key', (_label, ciJobKey) => {
    const result = groupRunsByJob([inJob('r1', ciJobKey), inJob('r2', 'api')])

    expect(ids(result.unnamed)).toStrictEqual(['r1'])
    expect(keys(result.groups)).toStrictEqual(['api'])
  })

  it('never creates a group for runs that carry no job key at all', () => {
    const result = groupRunsByJob([
      inJob('r1', undefined),
      inJob('r2', ''),
      inJob('r3', '  '),
    ])

    expect(result.groups).toStrictEqual([])
    expect(ids(result.unnamed)).toStrictEqual(['r1', 'r2', 'r3'])
  })

  it('never names a group unknown, unidentified or empty in a mixed CI run', () => {
    const result = groupRunsByJob([
      inJob('u1', undefined),
      inJob('u2', ''),
      inJob('a1', 'api', 'fail'),
      inJob('w1', 'web'),
    ])
    const names = keys(result.groups).map((key) => key.toLowerCase())

    expect(names).toStrictEqual(['api', 'web'])
    expect(names.some((name) => name === '' || name.includes('unknown'))).toBe(false)
    expect(ids(result.unnamed)).toStrictEqual(['u1', 'u2'])
  })

  it('returns nothing for a CI run with no runs', () => {
    expect(groupRunsByJob([])).toStrictEqual({ unnamed: [], groups: [] })
  })

  it('keeps the key exactly as stored, without humanizing it', () => {
    const result = groupRunsByJob([inJob('r1', 'test (node 20)'), inJob('r2', 'build-and-test')])

    expect(keys(result.groups)).toStrictEqual(['build-and-test', 'test (node 20)'])
  })

  it('keeps the original order of the runs inside a group and leaves the input untouched', () => {
    const input = [inJob('r3', 'api'), inJob('r1', 'api', 'fail'), inJob('r2', 'api')]
    const snapshot = ids(input)

    const result = groupRunsByJob(input)

    expect(ids(result.groups[0].runs)).toStrictEqual(['r3', 'r1', 'r2'])
    expect(ids(input)).toStrictEqual(snapshot)
  })

  it('keeps every run of a large CI run', () => {
    const input = [
      ...Array.from({ length: 300 }, (_, index) => inJob(`a${index}`, 'api')),
      ...Array.from({ length: 49 }, (_, index) => inJob(`w${index}`, 'web')),
      inJob('f1', 'web', 'fail'),
    ]

    const result = groupRunsByJob(input)

    expect(keys(result.groups)).toStrictEqual(['web', 'api'])
    expect(result.groups[0].runs).toHaveLength(50)
    expect(result.groups[1].runs).toHaveLength(300)
    expect(result.unnamed).toHaveLength(0)
  })
})

describe('reportLabel', () => {
  it('names a report by the file it came from', () => {
    expect(
      reportLabel('gha-900-api-junit-unit-xml-ab12cd34', {
        ciRunExternalId: '900',
        ciJobKey: 'api',
      }),
    ).toBe('junit-unit-xml')
    expect(
      reportLabel('gha-900-api-junit-e2e-xml-ef56ab78', {
        ciRunExternalId: '900',
        ciJobKey: 'api',
      }),
    ).toBe('junit-e2e-xml')
  })

  it('gives the two parts of a split report the same label', () => {
    const context = { ciRunExternalId: '900', ciJobKey: 'api' }

    expect(reportLabel('gha-900-api-junit-xml-ab12cd34-p1', context)).toBe('junit-xml')
    expect(reportLabel('gha-900-api-junit-xml-ab12cd34-p2', context)).toBe('junit-xml')
    expect(reportLabel('gha-900-api-junit-xml-ab12cd34-p12', context)).toBe('junit-xml')
    expect(reportLabel('gha-900-api-junit-xml-ab12cd34', context)).toBe('junit-xml')
  })

  it('removes the slugified job key when the key was set through QABLY_JOB_KEY', () => {
    expect(
      reportLabel('gha-900-test-node-20-junit-unit-xml-ab12cd34', {
        ciRunExternalId: '900',
        ciJobKey: 'test (node 20)',
      }),
    ).toBe('junit-unit-xml')
  })

  it('removes the raw job key when it came from GITHUB_JOB and is not a slug', () => {
    expect(
      reportLabel('gha-900-Build-API-junit-unit-xml-ab12cd34', {
        ciRunExternalId: '900',
        ciJobKey: 'Build-API',
      }),
    ).toBe('junit-unit-xml')
  })

  it('removes the job key only once', () => {
    expect(
      reportLabel('gha-900-junit-junit-xml-ab12cd34', {
        ciRunExternalId: '900',
        ciJobKey: 'junit',
      }),
    ).toBe('junit-xml')
  })

  it('keeps the job part when the job key does not match, so two reports still differ', () => {
    const context = { ciRunExternalId: '900', ciJobKey: 'other' }

    expect(reportLabel('gha-900-api-junit-unit-xml-ab12cd34', context)).toBe('api-junit-unit-xml')
    expect(reportLabel('gha-900-api-junit-e2e-xml-ef56ab78', context)).toBe('api-junit-e2e-xml')
  })

  it('keeps the job part when there is no job key', () => {
    expect(
      reportLabel('gha-900-api-junit-unit-xml-ab12cd34', { ciRunExternalId: '900' }),
    ).toBe('api-junit-unit-xml')
  })

  it('does not mistake a hex-looking word in the file name for the hash', () => {
    expect(
      reportLabel('gha-900-api-junit-deadbeef-ab12cd34', {
        ciRunExternalId: '900',
        ciJobKey: 'api',
      }),
    ).toBe('junit-deadbeef')
  })

  it('returns the full id when nothing is left once the job key is removed', () => {
    expect(
      reportLabel('gha-900-api--ab12cd34', { ciRunExternalId: '900', ciJobKey: 'api' }),
    ).toBe('gha-900-api--ab12cd34')
  })

  it.each<[string, string]>([
    ['an id from another producer', 'ci-42'],
    ['an id of another CI run', 'gha-901-api-junit-xml-ab12cd34'],
    ['a local run id', 'gha-local-job-junit-xml-ab12cd34'],
    ['an id without the 8-character hash', 'gha-900-api-junit-xml'],
    ['an id with a short hash', 'gha-900-api-junit-xml-ab12cd3'],
    ['an id with a long hash', 'gha-900-api-junit-xml-ab12cd345'],
    ['an id with a long hash and a part suffix', 'gha-900-api-junit-xml-ab12cd345-p1'],
    ['an id with a 16-character hash', 'gha-900-api-junit-xml-ab12cd34ef56ab78'],
    ['an id whose hash is not hexadecimal', 'gha-900-api-junit-xml-ab12cdzz'],
    ['an id whose hash is in upper case', 'gha-900-api-junit-xml-AB12CD34'],
  ])('returns the full id for %s', (_label, reportExternalId) => {
    expect(reportLabel(reportExternalId, { ciRunExternalId: '900', ciJobKey: 'api' })).toBe(
      reportExternalId,
    )
  })
})

describe('reportLabelsByRun', () => {
  const unit = 'gha-900-api-junit-unit-xml-ab12cd34'
  const e2e = 'gha-900-api-junit-e2e-xml-ef56ab78'

  function report(id: string, reportExternalId: string | undefined): CiRunJobRunRecord {
    return run(id, { ciJobKey: 'api', reportExternalId })
  }

  it('labels every run when the job uploaded more than one report', () => {
    const labels = reportLabelsByRun(
      [report('r1', unit), report('r2', e2e), report('r3', unit)],
      '900',
    )

    expect(Object.fromEntries(labels)).toStrictEqual({
      r1: 'junit-unit-xml',
      r2: 'junit-e2e-xml',
      r3: 'junit-unit-xml',
    })
  })

  it('shows no label when the job uploaded a single report', () => {
    expect(reportLabelsByRun([report('r1', unit), report('r2', unit)], '900').size).toBe(0)
  })

  it('counts the parts of a split report as one report', () => {
    const split = [
      report('r1', `${unit}-p1`),
      report('r2', `${unit}-p2`),
      report('r3', `${unit}-p3`),
    ]

    expect(reportLabelsByRun(split, '900').size).toBe(0)
    expect(Object.fromEntries(reportLabelsByRun([...split, report('r4', e2e)], '900'))).toStrictEqual({
      r1: 'junit-unit-xml',
      r2: 'junit-unit-xml',
      r3: 'junit-unit-xml',
      r4: 'junit-e2e-xml',
    })
  })

  it('does not count runs that have no report id', () => {
    expect(
      reportLabelsByRun(
        [report('r1', unit), report('r2', undefined), report('r3', '')],
        '900',
      ).size,
    ).toBe(0)
    expect(
      Object.fromEntries(
        reportLabelsByRun(
          [report('r1', unit), report('r2', undefined), report('r3', ''), report('r4', e2e)],
          '900',
        ),
      ),
    ).toStrictEqual({ r1: 'junit-unit-xml', r4: 'junit-e2e-xml' })
  })

  it('shows the full id of a report in another format next to a labelled one', () => {
    expect(
      Object.fromEntries(reportLabelsByRun([report('r1', unit), report('r2', 'ci-42')], '900')),
    ).toStrictEqual({ r1: 'junit-unit-xml', r2: 'ci-42' })
  })

  it('labels the runs of a job through the key each run carries', () => {
    const matrix = [
      run('r1', { ciJobKey: 'test (node 20)', reportExternalId: 'gha-900-test-node-20-junit-a-xml-ab12cd34' }),
      run('r2', { ciJobKey: 'test (node 20)', reportExternalId: 'gha-900-test-node-20-junit-b-xml-cd34ef56' }),
    ]

    expect(Object.fromEntries(reportLabelsByRun(matrix, '900'))).toStrictEqual({
      r1: 'junit-a-xml',
      r2: 'junit-b-xml',
    })
  })

  it('labels nothing for no runs', () => {
    expect(reportLabelsByRun([], '900').size).toBe(0)
  })
})

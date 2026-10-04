import { describe, expect, it } from 'vitest'
import type { CiRunJobRunRecord, RunStatus } from '@qably/types'
import { groupRunsByJob } from '@/features/runs/lib/ci-run-format'

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

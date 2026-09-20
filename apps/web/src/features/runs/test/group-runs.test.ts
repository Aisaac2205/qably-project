import { describe, expect, it } from 'vitest'
import type { RunSummaryRecord } from '@qably/types'
import { groupConsecutiveRuns } from '../lib/group-runs'

function run(id: string, overrides: Partial<RunSummaryRecord> = {}): RunSummaryRecord {
  return {
    id,
    projectId: 'proj-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    suiteName: 'Authentication',
    name: `Run ${id}`,
    status: 'pass',
    source: 'github_actions',
    externalId: id,
    reportExternalId: '',
    startedAt: '2026-06-16T10:00:00Z',
    caseCounts: { total: 1, pending: 0, running: 0, pass: 1, fail: 0, skip: 0, blocked: 0 },
    passRate: 1,
    delta: null,
    ...overrides,
  }
}

describe('groupConsecutiveRuns', () => {
  it('puts a run with no reportExternalId in its own group', () => {
    const groups = groupConsecutiveRuns([run('a')])

    expect(groups).toHaveLength(1)
    expect(groups[0].runs).toEqual([run('a')])
  })

  it('merges consecutive runs sharing a non-empty reportExternalId into one group', () => {
    const a = run('a', { reportExternalId: 'report-1' })
    const b = run('b', { reportExternalId: 'report-1' })
    const c = run('c', { reportExternalId: 'report-1' })

    const groups = groupConsecutiveRuns([a, b, c])

    expect(groups).toHaveLength(1)
    expect(groups[0].runs.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('never merges two runs that both have an empty reportExternalId', () => {
    const a = run('a', { reportExternalId: '' })
    const b = run('b', { reportExternalId: '' })

    const groups = groupConsecutiveRuns([a, b])

    expect(groups).toHaveLength(2)
    expect(groups[0].runs).toEqual([a])
    expect(groups[1].runs).toEqual([b])
  })

  it('does not merge runs that share a reportExternalId but are not adjacent', () => {
    const a = run('a', { reportExternalId: 'report-1' })
    const middle = run('middle', { reportExternalId: 'report-2' })
    const c = run('c', { reportExternalId: 'report-1' })

    const groups = groupConsecutiveRuns([a, middle, c])

    expect(groups).toHaveLength(3)
  })

  it('starts a new group once the reportExternalId changes', () => {
    const a = run('a', { reportExternalId: 'report-1' })
    const b = run('b', { reportExternalId: 'report-1' })
    const c = run('c', { reportExternalId: 'report-2' })

    const groups = groupConsecutiveRuns([a, b, c])

    expect(groups).toHaveLength(2)
    expect(groups[0].runs.map((r) => r.id)).toEqual(['a', 'b'])
    expect(groups[1].runs.map((r) => r.id)).toEqual(['c'])
  })
})

import { describe, it, expect } from 'vitest'
import type { ProjectActivity, ProjectListItem } from '@qably/types'
import { sortProjectsByAttention } from '@/features/dashboard/lib/project-attention'

function project(
  name: string,
  activity: ProjectActivity | null,
): ProjectListItem {
  return {
    id: name,
    name,
    organizationId: 'org-1',
    technologies: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    suiteCount: 0,
    activity,
  }
}

function activity(overrides: Partial<ProjectActivity> = {}): ProjectActivity {
  return {
    healthScore: 100,
    lastRunStatus: 'pass',
    lastRunAt: '2026-06-16T10:00:00Z',
    activeRunCount: 0,
    ...overrides,
  }
}

function names(projects: readonly ProjectListItem[]): string[] {
  return sortProjectsByAttention(projects).map((p) => p.name)
}

describe('sortProjectsByAttention', () => {
  it('puts a failing project first', () => {
    expect(
      names([
        project('passing', activity()),
        project('failing', activity({ lastRunStatus: 'fail', healthScore: 40 })),
      ]),
    ).toEqual(['failing', 'passing'])
  })

  it('ranks a run in flight above a passing project but below a failure', () => {
    expect(
      names([
        project('passing', activity()),
        project('running', activity({ lastRunStatus: 'running' })),
        project('failing', activity({ lastRunStatus: 'fail' })),
      ]),
    ).toEqual(['failing', 'running', 'passing'])
  })

  it('orders measured projects by the weakest pass rate first', () => {
    expect(
      names([
        project('strong', activity({ healthScore: 98 })),
        project('weak', activity({ healthScore: 41 })),
        project('middling', activity({ healthScore: 76 })),
      ]),
    ).toEqual(['weak', 'middling', 'strong'])
  })

  it('sinks projects that have never run below every measured one', () => {
    expect(
      names([
        project('never run', null),
        project('measured', activity({ healthScore: 100 })),
      ]),
    ).toEqual(['measured', 'never run'])
  })

  it('sinks a project with runs but nothing inside the window below measured ones', () => {
    expect(
      names([
        project('unmeasured window', activity({ healthScore: null })),
        project('measured', activity({ healthScore: 100 })),
      ]),
    ).toEqual(['measured', 'unmeasured window'])
  })

  it('keeps an unmeasured window above a project that never ran at all', () => {
    expect(
      names([
        project('never run', null),
        project('unmeasured window', activity({ healthScore: null })),
      ]),
    ).toEqual(['unmeasured window', 'never run'])
  })

  it('breaks ties on the most recent run', () => {
    expect(
      names([
        project('older', activity({ lastRunAt: '2026-06-10T10:00:00Z' })),
        project('newer', activity({ lastRunAt: '2026-06-16T10:00:00Z' })),
      ]),
    ).toEqual(['newer', 'older'])
  })

  it('falls back to the project name when nothing else separates two projects', () => {
    expect(names([project('Zeta', null), project('Alpha', null)])).toEqual([
      'Alpha',
      'Zeta',
    ])
  })

  it('does not mutate the list it was given', () => {
    const input = [
      project('passing', activity()),
      project('failing', activity({ lastRunStatus: 'fail' })),
    ]
    const before = input.map((p) => p.name)

    sortProjectsByAttention(input)

    expect(input.map((p) => p.name)).toEqual(before)
  })

  it('handles an empty list', () => {
    expect(sortProjectsByAttention([])).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import type { DashboardProjectRow } from '@qably/types'
import { sortDashboardProjects } from '@/features/dashboard/lib/dashboard-projects'

function project(overrides: Partial<DashboardProjectRow>): DashboardProjectRow {
  return {
    id: 'project-x',
    name: 'Project X',
    suites: 1,
    cases: 1,
    passRate: 0.5,
    ...overrides,
  }
}

describe('sortDashboardProjects', () => {
  it('sorts ascending by pass rate, risk first', () => {
    const projects = [
      project({ id: 'a', passRate: 0.82 }),
      project({ id: 'b', passRate: 0.45 }),
    ]

    const sorted = sortDashboardProjects(projects)

    expect(sorted.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('places projects with a null pass rate last, regardless of position', () => {
    const projects = [
      project({ id: 'a', passRate: null }),
      project({ id: 'b', passRate: 0.82 }),
      project({ id: 'c', passRate: 0.45 }),
    ]

    const sorted = sortDashboardProjects(projects)

    expect(sorted.map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })

  it('does not mutate the input array', () => {
    const projects = [project({ id: 'a', passRate: 0.82 }), project({ id: 'b', passRate: 0.45 })]
    const original = [...projects]

    sortDashboardProjects(projects)

    expect(projects).toEqual(original)
  })
})

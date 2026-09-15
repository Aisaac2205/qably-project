import { describe, it, expect } from 'vitest'
import type { ProjectActivity, ProjectListItem } from '@qably/types'
import { sortProjectsByAttention } from '@/features/dashboard/lib/project-attention'
import { sortProjects, filterProjectsByName } from '@/features/dashboard/lib/sort-projects'

function project(
  name: string,
  overrides: Partial<ProjectListItem> = {},
): ProjectListItem {
  return {
    id: name,
    name,
    organizationId: 'org-1',
    technologies: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    suiteCount: 0,
    activity: null,
    ...overrides,
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
  return projects.map((p) => p.name)
}

describe('sortProjects', () => {
  it('sorts by name ascending and descending', () => {
    const projects = [project('Zeta'), project('Alpha'), project('Mid')]

    expect(names(sortProjects(projects, 'name', 'asc'))).toEqual(['Alpha', 'Mid', 'Zeta'])
    expect(names(sortProjects(projects, 'name', 'desc'))).toEqual(['Zeta', 'Mid', 'Alpha'])
  })

  it('sorts by lastRun ascending and descending', () => {
    const projects = [
      project('newest', { activity: activity({ lastRunAt: '2026-06-16T10:00:00Z' }) }),
      project('oldest', { activity: activity({ lastRunAt: '2026-06-01T10:00:00Z' }) }),
      project('never', { activity: null }),
    ]

    expect(names(sortProjects(projects, 'lastRun', 'asc'))).toEqual(['never', 'oldest', 'newest'])
    expect(names(sortProjects(projects, 'lastRun', 'desc'))).toEqual(['newest', 'oldest', 'never'])
  })

  it('sorts by passRate ascending and descending', () => {
    const projects = [
      project('strong', { activity: activity({ healthScore: 98 }) }),
      project('weak', { activity: activity({ healthScore: 41 }) }),
      project('never', { activity: null }),
    ]

    expect(names(sortProjects(projects, 'passRate', 'asc'))).toEqual(['never', 'weak', 'strong'])
    expect(names(sortProjects(projects, 'passRate', 'desc'))).toEqual(['strong', 'weak', 'never'])
  })

  it('sorts by suites ascending and descending', () => {
    const projects = [
      project('three', { suiteCount: 3 }),
      project('zero', { suiteCount: 0 }),
      project('one', { suiteCount: 1 }),
    ]

    expect(names(sortProjects(projects, 'suites', 'asc'))).toEqual(['zero', 'one', 'three'])
    expect(names(sortProjects(projects, 'suites', 'desc'))).toEqual(['three', 'one', 'zero'])
  })

  it('delegates the attention key to sortProjectsByAttention regardless of direction', () => {
    const projects = [
      project('passing', { activity: activity() }),
      project('failing', { activity: activity({ lastRunStatus: 'fail', healthScore: 40 }) }),
    ]

    expect(sortProjects(projects, 'attention', 'asc')).toEqual(sortProjectsByAttention(projects))
    expect(sortProjects(projects, 'attention', 'desc')).toEqual(sortProjectsByAttention(projects))
  })

  it('does not mutate the list it was given', () => {
    const projects = [project('b'), project('a')]
    const before = names(projects)

    sortProjects(projects, 'name', 'asc')

    expect(names(projects)).toEqual(before)
  })
})

describe('filterProjectsByName', () => {
  it('matches case-insensitively against a substring', () => {
    const projects = [project('Ecommerce App'), project('Mobile App'), project('API Backend')]

    expect(names(filterProjectsByName(projects, 'app'))).toEqual(['Ecommerce App', 'Mobile App'])
    expect(names(filterProjectsByName(projects, 'API'))).toEqual(['API Backend'])
  })

  it('returns every project for an empty or blank query', () => {
    const projects = [project('One'), project('Two')]

    expect(filterProjectsByName(projects, '')).toEqual(projects)
    expect(filterProjectsByName(projects, '   ')).toEqual(projects)
  })

  it('returns an empty list when nothing matches', () => {
    const projects = [project('One'), project('Two')]

    expect(filterProjectsByName(projects, 'zzz')).toEqual([])
  })

  it('searches against the full list, not a capped subset', () => {
    const projects = Array.from({ length: 8 }, (_, i) => project(`Project ${i}`))
    const target = project('Needle outside the cap')

    expect(filterProjectsByName([...projects, target], 'needle')).toEqual([target])
  })
})

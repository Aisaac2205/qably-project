import type { ProjectListItem } from '@qably/types'
import { sortProjectsByAttention } from '@/features/dashboard/lib/project-attention'

export type ProjectSortKey = 'attention' | 'name' | 'lastRun' | 'passRate' | 'suites'
export type SortDirection = 'asc' | 'desc'

function sortValue(project: ProjectListItem, key: Exclude<ProjectSortKey, 'attention'>): string | number {
  switch (key) {
    case 'name':
      return project.name.toLowerCase()
    case 'lastRun':
      return project.activity?.lastRunAt ?? ''
    case 'passRate':
      return project.activity?.healthScore ?? -1
    case 'suites':
      return project.suiteCount
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  return (a as number) - (b as number)
}

export function sortProjects(
  projects: readonly ProjectListItem[],
  key: ProjectSortKey,
  dir: SortDirection,
): ProjectListItem[] {
  if (key === 'attention') return sortProjectsByAttention(projects)

  const sorted = [...projects].sort((a, b) => compareValues(sortValue(a, key), sortValue(b, key)))
  return dir === 'desc' ? sorted.reverse() : sorted
}

export function filterProjectsByName(
  projects: readonly ProjectListItem[],
  query: string,
): ProjectListItem[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...projects]

  return projects.filter((project) => project.name.toLowerCase().includes(normalized))
}

import type { ProjectListItem } from '@qably/types'

export const projectFixtures: ProjectListItem[] = [
  {
    id: 'proj-1',
    name: 'Ecommerce App',
    description: 'Checkout, catalog, and user account flows.',
    githubRepo: 'acme/ecommerce-app',
    organizationId: 'org-1',
    technologies: ['react', 'typescript', 'vite'],
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z',
    suiteCount: 3,
    activity: null,
  },
  {
    id: 'proj-2',
    name: 'Mobile App',
    description: 'Flutter iOS and Android client.',
    githubRepo: 'acme/mobile-app',
    organizationId: 'org-1',
    technologies: ['flutter', 'javascript', 'typescript'],
    createdAt: '2026-02-05T00:00:00Z',
    updatedAt: '2026-02-05T00:00:00Z',
    suiteCount: 0,
    activity: null,
  },
  {
    id: 'proj-3',
    name: 'API Backend',
    description: 'REST API and webhook processing.',
    githubRepo: 'acme/api-backend',
    organizationId: 'org-1',
    technologies: ['java', 'springboot', 'postgresql'],
    createdAt: '2026-02-20T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
    suiteCount: 0,
    activity: null,
  },
  {
    id: 'proj-4',
    name: 'Admin Panel',
    description: 'Internal dashboard for operations.',
    githubRepo: 'acme/admin-panel',
    organizationId: 'org-1',
    technologies: ['angular', 'typescript', 'express'],
    createdAt: '2026-03-10T00:00:00Z',
    updatedAt: '2026-03-10T00:00:00Z',
    suiteCount: 0,
    activity: null,
  },
]

let projects: ProjectListItem[] = structuredClone(projectFixtures)

export function __resetProjectsStub(): void {
  projects = structuredClone(projectFixtures)
}

export function listProjects(): Promise<ProjectListItem[]> {
  return Promise.resolve(projects)
}

export function getProject(id: string): Promise<ProjectListItem> {
  const found = projects.find((project) => project.id === id)

  return found === undefined
    ? Promise.reject(new Error(`project ${id} not found`))
    : Promise.resolve(found)
}

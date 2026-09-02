import type { OrganizationSummary } from '@qably/types'

export const organizationFixtures: OrganizationSummary[] = [
  {
    id: 'org-1',
    name: 'Acme QA Team',
    slug: 'acme-qa',
    plan: 'equipo',
    role: 'owner',
  },
]

let organizations: OrganizationSummary[] = structuredClone(organizationFixtures)

export function __resetOrganizationsStub(): void {
  organizations = structuredClone(organizationFixtures)
}

export function listOrganizations(): Promise<OrganizationSummary[]> {
  return Promise.resolve(organizations)
}

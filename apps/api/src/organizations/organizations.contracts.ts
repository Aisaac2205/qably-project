import type { OrgRole } from '../../generated/prisma/enums';
import type { RequestWithSession } from '../auth/auth.contracts';

export interface OrgContext {
  organizationId: string;
  slug: string;
  role: OrgRole;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
}

export type OrgResolutionError = 'not-a-member';

export interface RequestWithOrg extends RequestWithSession {
  org?: OrgContext;
}

export const ORGANIZATION_HEADER = 'x-organization-id';

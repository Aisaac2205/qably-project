import type { OrganizationContext, OrganizationSummary } from '@qably/types';
import type { RequestWithSession } from '../auth/auth.contracts';

export type OrgContext = OrganizationContext;

export type { OrganizationSummary };

export type OrgResolutionError = 'not-a-member';

export interface RequestWithOrg extends RequestWithSession {
  org?: OrgContext;
}

export const ORGANIZATION_HEADER = 'x-organization-id';

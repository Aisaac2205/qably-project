import type { OrgMember } from '@qably/types';

export type { OrgMember };

export type MemberManageError =
  | 'forbidden'
  | 'not-found'
  | 'last-owner-required';

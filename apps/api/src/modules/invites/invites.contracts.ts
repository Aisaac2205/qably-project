import type { InvitePreviewRecord, OrgRole } from '@qably/types';

export type { InvitePreviewRecord };

export interface OrgInviteSummary {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  expiresAt: string;
  invitedByName: string | null;
}

export interface CreateInviteResult extends OrgInviteSummary {
  emailDelivered: boolean;
}

export type InviteCreateError =
  | 'forbidden'
  | 'seat-limit-reached'
  | 'already-member';

export type InviteManageError = 'forbidden' | 'not-found';

export type InvitePreviewError = 'invite-invalid-or-used';

export type InviteAcceptError =
  | 'invite-invalid-or-used'
  | 'invite-expired'
  | 'invite-email-mismatch'
  | 'seat-limit-reached';

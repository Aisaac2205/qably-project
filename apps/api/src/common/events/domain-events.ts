/**
 * Domain facts the API publishes after they are committed. An emitter names the
 * event and a subscriber listens by the same constant, so neither knows the
 * other. Add a new event here first (see docs/DOMAIN_EVENTS.md).
 */
export const DOMAIN_EVENTS = {
  proposalApproved: 'proposal.approved',
  proposalRejected: 'proposal.rejected',
  scmEventFailed: 'scm_event.failed',
} as const;

export interface ProposalApprovedEvent {
  readonly proposalId: string;
  readonly projectId: string;
  readonly organizationId: string;
  /** Null when the approval published over a case and the proposal has no suite. */
  readonly suiteId: string | null;
  readonly testCaseId: string;
  readonly versionId: string;
  readonly createdNewCase: boolean;
  readonly actorId: string;
}

export interface ProposalRejectedEvent {
  readonly proposalId: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly suiteId: string | null;
  readonly decisionId: string;
  readonly actorId: string;
}

export interface ScmEventFailedEvent {
  readonly scmEventId: string;
  readonly organizationId: string;
  readonly repo: string;
  readonly connectionId: string;
}

export interface DomainEventMap {
  [DOMAIN_EVENTS.proposalApproved]: ProposalApprovedEvent;
  [DOMAIN_EVENTS.proposalRejected]: ProposalRejectedEvent;
  [DOMAIN_EVENTS.scmEventFailed]: ScmEventFailedEvent;
}

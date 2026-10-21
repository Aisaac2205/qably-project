/**
 * Domain facts the API publishes after they are committed. An emitter names the
 * event and a subscriber listens by the same constant, so neither knows the
 * other. Add a new event here first (see docs/DOMAIN_EVENTS.md).
 */
export const DOMAIN_EVENTS = {
  proposalApproved: 'proposal.approved',
  proposalRejected: 'proposal.rejected',
  proposalsCreated: 'proposals.created',
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

/** Where a batch of new proposals came from. Matches the `source` of a `proposals_ready` notification. */
export type ProposalsCreatedSource = 'push' | 'documentation' | 'chat';

/**
 * New proposals are waiting in the review inbox. One event announces one batch:
 * every proposal one occurrence of the source produced.
 */
export interface ProposalsCreatedEvent {
  readonly source: ProposalsCreatedSource;
  readonly organizationId: string;
  readonly projectId: string;
  /**
   * What the review inbox filters on to show only this batch: the ingestion
   * batch id for a push, the proposal id for a source that creates a single
   * proposal (documentation of one case, a chat suggestion).
   */
  readonly batchId: string;
  /** How many proposals this occurrence created. A push can announce the same batch again with a larger number. */
  readonly count: number;
  /** Push only. */
  readonly commitSha?: string;
  /** Push only, when the SCM event is still on record. */
  readonly author?: string;
  /** Push only, when the SCM event is still on record. */
  readonly branch?: string;
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
  [DOMAIN_EVENTS.proposalsCreated]: ProposalsCreatedEvent;
  [DOMAIN_EVENTS.scmEventFailed]: ScmEventFailedEvent;
}

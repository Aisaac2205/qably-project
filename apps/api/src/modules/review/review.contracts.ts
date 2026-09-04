import type {
  Evidence,
  ExtractedProposal,
  ProposalStatus,
  TraceabilityLink,
} from '@qably/types';

export type ProposalView = ExtractedProposal;

export interface ProposalDetailView extends ProposalView {
  evidence: Evidence | null;
  links: TraceabilityLink[];
}

export interface ListProposalsFilters {
  projectId?: string;
  status?: ProposalStatus;
  duplicatesOnly?: boolean;
  search?: string;
}

export type ReviewError =
  | 'not-found'
  | 'invalid-transition'
  | 'missing-evidence'
  | 'missing-suite'
  | 'name-taken';

export interface DecisionInput {
  actorId: string;
  comment?: string;
}

export interface ApprovalView {
  createdNewCase: boolean;
  testCaseId: string;
  versionId: string;
  version: number;
  decisionId: string;
}

export interface RejectionView {
  decisionId: string;
}

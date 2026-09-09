import type { Locale } from '@qably/i18n';
import type {
  Evidence,
  ExtractedProposal,
  ProposalStatus,
  SuiteProposal,
  SuiteProposalDecision,
  TraceabilityLink,
} from '@qably/types';

export interface ProposalView extends ExtractedProposal {
  evidenceTitle: string;
}

export type SuiteProposalView = SuiteProposal;
export type SuiteProposalDecisionView = SuiteProposalDecision;

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

export const EXTRACTION_QUEUE = 'extraction';

export interface DocumentFileTarget {
  testCaseId: string;
  automationKey: string;
}

export type ExtractionJobData =
  | { kind: 'code-change'; codeChangeId: string; locale: Locale }
  | { kind: 'document-case'; testCaseId: string; locale: Locale }
  | {
      kind: 'document-file';
      filePath: string;
      targets: DocumentFileTarget[];
      locale: Locale;
    };

export type DocumentCaseError =
  | 'not-found'
  | 'not-automated'
  | 'no-source-file'
  | 'already-pending';

export type DocumentFilesError = 'not-found';

export type DocumentFilesMode = 'undocumented' | 'stale-locale';

export type {
  DocumentFilesResult,
  DocumentFilesSkip,
  DocumentFilesSkipReason,
} from '@qably/types';

export type ReviewError =
  | 'not-found'
  | 'invalid-transition'
  | 'missing-evidence'
  | 'incomplete-proposal'
  | 'missing-suite'
  | 'name-taken';

export interface DecisionInput {
  actorId: string;
  comment?: string;
}

export interface ApprovalView {
  createdNewCase: boolean;
  testCaseId: string;
  testCaseName: string;
  suiteId: string | null;
  versionId: string;
  version: number;
  decisionId: string;
}

export interface RejectionView {
  decisionId: string;
}

export interface BulkDecisionItemResult {
  id: string;
  outcome: 'approved' | 'rejected' | 'skipped';
  reason?: ReviewError;
}

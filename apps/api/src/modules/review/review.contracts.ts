import type { Locale } from '@qably/i18n';
import type {
  Evidence,
  ExtractedProposal,
  ProposalStatus,
  TraceabilityLink,
} from '@qably/types';

export type {
  DuplicateCandidateView,
  DuplicateMatchReason,
} from '@qably/types';

export interface ProposalView extends ExtractedProposal {
  evidenceTitle: string;
}

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

export interface ReviewInboxPageFilters {
  projectId?: string;
  status: ProposalStatus;
  duplicatesOnly?: boolean;
  search?: string;
  cursor?: string;
  limit: number;
}

export interface ReviewInboxPage {
  items: ProposalView[];
  nextCursor: string | null;
}

export interface ReviewInboxCountsFilters {
  projectId?: string;
  search?: string;
}

export type ReviewInboxStatusCounts = Record<ProposalStatus, number>;

export interface ReviewInboxCounts {
  byStatus: ReviewInboxStatusCounts;
  version: string;
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
      requestSuiteSummary?: boolean;
    }
  | { kind: 'document-suite-metadata'; suiteId: string; locale: Locale };

export type DocumentCaseError =
  | 'not-found'
  | 'not-automated'
  | 'no-automation-key'
  | 'no-source-file'
  | 'already-pending';

export type DocumentFilesError = 'not-found';

export type DocumentFilesMode = 'undocumented' | 'stale-locale' | 'incomplete';

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

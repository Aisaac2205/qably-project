import type { Locale } from '@qably/i18n';
import type {
  CaseStatus,
  Evidence,
  ExtractedProposal,
  ProposalOrigin,
  ProposalStatus,
  ReviewApprovalConflictCode,
  ReviewConflictingCase,
  TraceabilityLink,
} from '@qably/types';
import type { ProposalClassification } from './lib/classify-proposal';

export interface ProposalView extends ExtractedProposal {
  evidenceTitle: string;
}

export interface InboxSuite {
  id: string;
  name: string;
}

export interface InboxClassification extends ProposalClassification {
  matchedCaseName: string | null;
  /** Where the matched case lives, so the inbox can link straight to it. */
  matchedCaseSuiteId: string | null;
}

export interface InboxItem extends ProposalView {
  suite: InboxSuite | null;
  classification: InboxClassification;
  origin: ProposalOrigin;
}

export interface MatchedCaseView {
  id: string;
  name: string;
  suiteId: string;
  suiteName: string;
}

export interface PublishedVersionView {
  /** Sent back on approve as `baseVersionId`: the version the reviewer saw. */
  id: string;
  version: number;
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  publishedAt: string;
  publishedBy: { id: string; name: string } | null;
}

export interface ProposalSourceView {
  filePath: string;
  uri: string;
  commitSha: string | null;
  pullRequestNumber: number | null;
}

export interface RecentRunView {
  runId: string;
  status: CaseStatus;
  recordedAt: string;
}

export interface ProposalDetailView extends ProposalView {
  evidence: Evidence | null;
  links: TraceabilityLink[];
  matchedCase: MatchedCaseView | null;
  publishedVersion: PublishedVersionView | null;
  source: ProposalSourceView | null;
  recentRuns: RecentRunView[];
  decision: LastDecisionView | null;
}

export interface ReviewInboxPageFilters {
  projectId?: string;
  status: ProposalStatus | 'all';
  duplicatesOnly?: boolean;
  search?: string;
  cursor?: string;
  limit: number;
}

export interface ReviewInboxPage {
  items: InboxItem[];
  nextCursor: string | null;
}

export interface ReviewInboxCountsFilters {
  projectId?: string;
  search?: string;
}

export type ReviewInboxStatusCounts = Record<ProposalStatus, number>;

export type ReviewInboxDuplicateKindCounts = Record<
  'none' | 'update' | 'possible_duplicate',
  number
>;

export interface ReviewInboxCounts {
  byStatus: ReviewInboxStatusCounts;
  byDuplicateKind: ReviewInboxDuplicateKindCounts;
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
  | 'missing-suite';

export interface ApprovalConflict {
  readonly code: ReviewApprovalConflictCode;
  readonly conflictingCase: ReviewConflictingCase | null;
}

export type ApprovalError =
  | ReviewError
  | 'invalid-apply-target'
  | 'stale-proposal'
  | ApprovalConflict;

export interface DecisionInput {
  actorId: string;
  comment?: string;
}

/**
 * Where an approved proposal lands. `matched-case` publishes it as a new
 * version of the case a possible duplicate was matched to; `new-case` keeps
 * the default of creating a case of its own.
 */
export type ApplyTo = 'matched-case' | 'new-case';

export interface ApprovalInput extends DecisionInput {
  applyTo?: ApplyTo;
  /**
   * The published version of the case the reviewer saw, `null` when it had
   * none. The approval is refused with `stale-proposal` when the case has
   * moved past it. Left out, the proposal's own recorded base applies.
   */
  baseVersionId?: string | null;
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

export interface LastDecisionView {
  action: 'approved' | 'rejected';
  decidedAt: string;
  decidedBy: { id: string; name: string };
}

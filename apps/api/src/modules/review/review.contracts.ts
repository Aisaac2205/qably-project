export type ReviewError =
  | 'not-found'
  | 'invalid-transition'
  | 'missing-evidence'
  | 'missing-suite';

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

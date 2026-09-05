import type {
  RunCaseRecord,
  RunRecord,
  RunsPageRecord,
  RunSummaryRecord,
} from '@qably/types';

export type RunView = RunRecord;
export type RunCaseView = RunCaseRecord;
export type RunSummaryView = RunSummaryRecord;
export type RunsPageView = RunsPageRecord;

export type RunError = 'suite-not-found' | 'source-not-allowed';

export type RunQueryError =
  | 'not-found'
  | 'suite-not-found'
  | 'empty-suite'
  | 'case-not-found'
  | 'source-not-editable';

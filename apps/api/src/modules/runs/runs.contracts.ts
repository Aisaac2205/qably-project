import type {
  JunitIngestRecord,
  RegressionsRecord,
  RunCaseRecord,
  RunRecord,
  RunsPageRecord,
  RunSummaryRecord,
  SuiteMetricsRecord,
} from '@qably/types';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import type { IngestRunInput } from './runs.schemas';

export const RUN_INGEST_QUEUE = 'run-ingest';

export type RunView = RunRecord;
export type RunCaseView = RunCaseRecord;
export type RunSummaryView = RunSummaryRecord;
export type RunsPageView = RunsPageRecord;
export type SuiteMetricsView = SuiteMetricsRecord;
export type RegressionsView = RegressionsRecord;
export type JunitIngestView = JunitIngestRecord;

export interface RunIngestJobData {
  apiKey: ApiKeyIdentity;
  body: IngestRunInput;
}

export type RunError = 'suite-not-found' | 'source-not-allowed';

export type RunQueryError =
  | 'not-found'
  | 'suite-not-found'
  | 'empty-suite'
  | 'no-manual-cases'
  | 'case-not-found'
  | 'source-not-editable';

import type { RunCaseRecord, RunRecord } from '@qably/types';

export type RunView = RunRecord;
export type RunCaseView = RunCaseRecord;

export type RunError = 'suite-not-found' | 'source-not-allowed';

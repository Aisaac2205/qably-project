import type { Suite, TestCase } from '@qably/types';

export type {
  ConfirmDocumentationResult,
  SuiteSummariesPage,
  SuiteTagsFacet,
} from '@qably/types';

export type SuiteView = Suite;
export type TestCaseView = TestCase;

export type SuiteError = 'not-found' | 'name-taken' | 'forbidden';

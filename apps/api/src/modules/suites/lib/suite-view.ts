import type { Locale } from '@qably/i18n';
import type {
  CaseDocumentationField,
  DocumentationOutcome,
  DocumentationState,
  ExecutionMode,
  SuiteDocumentationField,
} from '@qably/types';
import { isLocaleStale } from '../../../common/locale/stale-locale';
import type { SuiteView, TestCaseView } from '../suites.contracts';

export const CASE_SELECT = {
  id: true,
  suiteId: true,
  name: true,
  objective: true,
  preconditions: true,
  steps: true,
  expectedResult: true,
  priority: true,
  state: true,
  executionMode: true,
  automationKey: true,
  automationClassName: true,
  automationFilePath: true,
  observations: true,
  documentationSource: true,
  documentationQueuedAt: true,
  documentationOutcome: true,
  documentationOutcomeAt: true,
  documentationMissing: true,
  documentationSkipReason: true,
  currentVersion: { select: { version: true, locale: true } },
} as const;

export const SUITE_SELECT = {
  id: true,
  projectId: true,
  organizationId: true,
  name: true,
  description: true,
  tags: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
  documentationQueuedAt: true,
  documentationOutcome: true,
  documentationOutcomeAt: true,
  documentationMissing: true,
  documentationSkipReason: true,
  cases: { select: CASE_SELECT, orderBy: { position: 'asc' } },
} as const;

export interface CaseRow {
  id: string;
  suiteId: string;
  name: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  state: 'active' | 'draft' | 'deprecated';
  executionMode: ExecutionMode;
  automationKey: string | null;
  automationClassName: string | null;
  automationFilePath: string | null;
  observations?: unknown;
  documentationSource: string;
  documentationQueuedAt: Date | null;
  documentationOutcome: string | null;
  documentationOutcomeAt: Date | null;
  documentationMissing: string[];
  documentationSkipReason: string | null;
  currentVersion: { version: number; locale?: string | null } | null;
}

export interface SuiteRow {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  documentationQueuedAt: Date | null;
  documentationOutcome: string | null;
  documentationOutcomeAt: Date | null;
  documentationMissing: string[];
  documentationSkipReason: string | null;
  cases: CaseRow[];
}

export interface DocumentationColumns {
  documentationQueuedAt: Date | null;
  documentationOutcome: string | null;
  documentationOutcomeAt: Date | null;
  documentationMissing: string[];
  documentationSkipReason: string | null;
}

export function observationsOf(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const strings = raw.filter(
    (item): item is string => typeof item === 'string',
  );
  return strings.length === 0 ? undefined : strings;
}

export function toDocumentationState<Field extends string>(
  row: DocumentationColumns,
): DocumentationState<Field> {
  return {
    outcome: (row.documentationOutcome as DocumentationOutcome | null) ?? null,
    missing: (row.documentationMissing ?? []) as Field[],
    skipReason: row.documentationSkipReason ?? null,
    queuedAt: row.documentationQueuedAt?.toISOString() ?? null,
    outcomeAt: row.documentationOutcomeAt?.toISOString() ?? null,
  };
}

export function toCaseView(
  testCase: CaseRow,
  orgDefaultLocale: Locale,
): TestCaseView {
  const documentedLocale = testCase.currentVersion?.locale ?? null;
  const base = {
    id: testCase.id,
    suiteId: testCase.suiteId,
    version: testCase.currentVersion?.version ?? null,
    documentedLocale,
    localeStale: isLocaleStale(
      { steps: testCase.steps, documentedLocale },
      orgDefaultLocale,
    ),
    name: testCase.name,
    objective: testCase.objective,
    preconditions: testCase.preconditions,
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    priority: testCase.priority,
    state: testCase.state,
    executionMode: testCase.executionMode,
    documentation: toDocumentationState<CaseDocumentationField>(testCase),
    ...(observationsOf(testCase.observations) === undefined
      ? {}
      : { observations: observationsOf(testCase.observations) }),
  };

  if (testCase.executionMode !== 'automated') return base;

  return {
    ...base,
    ...(testCase.automationKey === null
      ? {}
      : { automationKey: testCase.automationKey }),
    ...(testCase.automationClassName === null
      ? {}
      : { automationClassName: testCase.automationClassName }),
    ...(testCase.automationFilePath === null
      ? {}
      : { automationFilePath: testCase.automationFilePath }),
    lastResult: null,
  };
}

export function toView(row: SuiteRow, orgDefaultLocale: Locale): SuiteView {
  const cases = row.cases.map((testCase) =>
    toCaseView(testCase, orgDefaultLocale),
  );
  const automatedCases = cases.filter(
    (testCase) => testCase.executionMode === 'automated',
  ).length;

  return {
    id: row.id,
    projectId: row.projectId,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    tags: row.tags,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    manualCases: cases.length - automatedCases,
    automatedCases,
    undocumentedCount: 0,
    staleLocaleCount: 0,
    incompleteCount: 0,
    documentation: toDocumentationState<SuiteDocumentationField>(row),
    cases,
  };
}

export type CaseDocumentationField =
  | 'title'
  | 'objective'
  | 'steps'
  | 'expectedResult';

export type SuiteDocumentationField = 'name' | 'description' | 'tags';

export type DocumentationOutcome =
  | 'complete'
  | 'incomplete'
  | 'failed'
  | 'skipped';

export interface DocumentationAssessment<Field extends string> {
  complete: boolean;
  missing: Field[];
}

export interface DocumentationState<Field extends string> {
  outcome: DocumentationOutcome | null;
  missing: Field[];
  skipReason: string | null;
  queuedAt: string | null;
  outcomeAt: string | null;
}

export type CaseDocumentationState = DocumentationState<CaseDocumentationField>;
export type SuiteDocumentationState = DocumentationState<SuiteDocumentationField>;

export interface CaseDocumentationInput {
  name: string;
  automationKey: string | null | undefined;
  objective: string;
  steps: readonly string[];
  expectedResult: string;
}

export interface SuiteDocumentationInput {
  name: string;
  description: string;
  tags: readonly string[];
}

export function assessCaseDocumentation(
  input: CaseDocumentationInput,
): DocumentationAssessment<CaseDocumentationField> {
  const missing: CaseDocumentationField[] = [];

  const trimmedName = input.name.trim();
  const trimmedAutomationKey = (input.automationKey ?? '').trim();
  if (trimmedName.length === 0 || trimmedName === trimmedAutomationKey) {
    missing.push('title');
  }

  if (input.objective.trim().length === 0) missing.push('objective');
  if (input.steps.length === 0) missing.push('steps');
  if (input.expectedResult.trim().length === 0) missing.push('expectedResult');

  return { complete: missing.length === 0, missing };
}

export function assessSuiteDocumentation(
  input: SuiteDocumentationInput,
): DocumentationAssessment<SuiteDocumentationField> {
  const missing: SuiteDocumentationField[] = [];

  if (input.name.trim().length === 0) missing.push('name');
  if (input.description.trim().length === 0) missing.push('description');
  if (input.tags.length === 0) missing.push('tags');

  return { complete: missing.length === 0, missing };
}

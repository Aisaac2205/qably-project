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

type MaybeText = string | null | undefined;
type MaybeList<T> = readonly T[] | null | undefined;

function toText(value: MaybeText): string {
  return value ?? '';
}

function toList<T>(value: MaybeList<T>): readonly T[] {
  return value ?? [];
}

export function normalizeTitleForComparison(value: MaybeText): string {
  return toText(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface CaseDocumentationInput {
  name: MaybeText;
  automationKey: MaybeText;
  objective: MaybeText;
  steps: MaybeList<string>;
  expectedResult: MaybeText;
}

export interface SuiteDocumentationInput {
  name: MaybeText;
  description: MaybeText;
  tags: MaybeList<string>;
}

export function assessCaseDocumentation(
  input: CaseDocumentationInput,
): DocumentationAssessment<CaseDocumentationField> {
  const missing: CaseDocumentationField[] = [];

  const trimmedName = toText(input.name).trim();
  if (
    trimmedName.length === 0 ||
    normalizeTitleForComparison(input.name) ===
      normalizeTitleForComparison(input.automationKey)
  ) {
    missing.push('title');
  }

  if (toText(input.objective).trim().length === 0) missing.push('objective');
  if (toList(input.steps).length === 0) missing.push('steps');
  if (toText(input.expectedResult).trim().length === 0) {
    missing.push('expectedResult');
  }

  return { complete: missing.length === 0, missing };
}

export function assessSuiteDocumentation(
  input: SuiteDocumentationInput,
): DocumentationAssessment<SuiteDocumentationField> {
  const missing: SuiteDocumentationField[] = [];

  if (toText(input.name).trim().length === 0) missing.push('name');
  if (toText(input.description).trim().length === 0) missing.push('description');
  if (toList(input.tags).length === 0) missing.push('tags');

  return { complete: missing.length === 0, missing };
}

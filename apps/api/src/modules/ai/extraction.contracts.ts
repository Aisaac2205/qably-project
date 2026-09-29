import { z } from 'zod';
import { normalizeTitleForComparison } from '@qably/types';
import { truncateOnWordBoundary } from '../../common/text/truncate-on-word-boundary';
import { truncateTo } from '../../common/text/truncate-to';
import { fitCaseTitle } from './fit-case-title';
import { parseTargetRef } from './target-reference';

export const MAX_SOURCE_CONTENT_LENGTH = 60_000;
export const MAX_EXTRACTED_CASES = 20;

const JUNIT_INGESTION_NAME_MAX_LENGTH = 120;
const JUNIT_INGESTION_CLASSNAME_MAX_LENGTH = 250;
const COMPOSITE_KEY_SEPARATOR_LENGTH = '::'.length;
const AUTOMATION_KEY_MAX_LENGTH =
  JUNIT_INGESTION_CLASSNAME_MAX_LENGTH +
  COMPOSITE_KEY_SEPARATOR_LENGTH +
  JUNIT_INGESTION_NAME_MAX_LENGTH;

export const CASE_LIMITS = {
  title: 120,
  objective: 500,
  expectedResult: 500,
  listItem: 300,
  sourceExcerpt: 600,
  observation: 200,
  steps: 20,
  preconditions: 10,
  observations: 5,
} as const;

export const SUITE_LIMITS = {
  title: 80,
  description: 300,
  tag: 40,
  tags: 20,
} as const;

export const shortText = (max: number) => z.string().trim().min(1).max(max);

const repairedText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value) => truncateOnWordBoundary(value, max))
    .pipe(z.string().max(max));

const keepFirst = (limit: number) => (value: unknown) =>
  Array.isArray(value) ? value.slice(0, limit) : value;

const automationKeyText = z
  .string()
  .trim()
  .min(1)
  .transform((value) => truncateTo(value, AUTOMATION_KEY_MAX_LENGTH));

const LEADING_ORDINAL = /^\d+[.)]\s*/;

const withoutOrdinal = z
  .string()
  .trim()
  .transform((value) => value.replace(LEADING_ORDINAL, ''));

const listItem = (max: number) => withoutOrdinal.pipe(shortText(max));

const repairedListItem = (max: number) =>
  withoutOrdinal.pipe(repairedText(max));

export const extractedCaseObjectSchema = z.object({
  automationKey: automationKeyText,
  title: shortText(CASE_LIMITS.title),
  objective: shortText(CASE_LIMITS.objective),
  preconditions: z
    .array(listItem(CASE_LIMITS.listItem))
    .max(CASE_LIMITS.preconditions)
    .default([]),
  steps: z.array(listItem(CASE_LIMITS.listItem)).min(1).max(CASE_LIMITS.steps),
  expectedResult: shortText(CASE_LIMITS.expectedResult),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  sourceExcerpt: shortText(CASE_LIMITS.sourceExcerpt),
  observations: z
    .array(shortText(CASE_LIMITS.observation))
    .max(CASE_LIMITS.observations)
    .optional(),
});

const repairedCaseFields = {
  title: z.string().trim().min(1),
  objective: repairedText(CASE_LIMITS.objective),
  preconditions: z
    .preprocess(
      keepFirst(CASE_LIMITS.preconditions),
      z
        .array(repairedListItem(CASE_LIMITS.listItem))
        .max(CASE_LIMITS.preconditions),
    )
    .default([]),
  steps: z.preprocess(
    keepFirst(CASE_LIMITS.steps),
    z
      .array(repairedListItem(CASE_LIMITS.listItem))
      .min(1)
      .max(CASE_LIMITS.steps),
  ),
  expectedResult: repairedText(CASE_LIMITS.expectedResult),
  sourceExcerpt: repairedText(CASE_LIMITS.sourceExcerpt),
  observations: z
    .preprocess(
      keepFirst(CASE_LIMITS.observations),
      z
        .array(repairedText(CASE_LIMITS.observation))
        .max(CASE_LIMITS.observations),
    )
    .optional(),
};

export const extractedCaseSchema = extractedCaseObjectSchema
  .extend({
    ...repairedCaseFields,
    targetRef: z.unknown().transform(parseTargetRef).optional(),
  })
  .refine(
    (data) =>
      normalizeTitleForComparison(
        truncateTo(data.title, AUTOMATION_KEY_MAX_LENGTH),
      ) !== normalizeTitleForComparison(data.automationKey),
    {
      message: 'title must be different from the raw automationKey',
      path: ['title'],
    },
  )
  .transform((data) => ({
    ...data,
    title: fitCaseTitle(data.title, CASE_LIMITS.title),
  }));

export const extractedSuiteSchema = z.object({
  title: shortText(SUITE_LIMITS.title),
  description: shortText(SUITE_LIMITS.description),
  tags: z.array(shortText(SUITE_LIMITS.tag)).max(SUITE_LIMITS.tags).default([]),
});

export const suiteSummarySchema = z.object({
  title: shortText(SUITE_LIMITS.title),
  description: shortText(SUITE_LIMITS.description),
  tags: z.array(shortText(SUITE_LIMITS.tag)).min(1).max(SUITE_LIMITS.tags),
});

export const extractionOutputSchema = z.object({
  cases: z.array(extractedCaseSchema).max(MAX_EXTRACTED_CASES),
  suite: extractedSuiteSchema.optional(),
});

export type ExtractedCase = z.infer<typeof extractedCaseSchema>;
export type ExtractedSuite = z.infer<typeof extractedSuiteSchema>;
export type SuiteSummary = z.infer<typeof suiteSummarySchema>;

export type ExtractionLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'go'
  | 'csharp'
  | 'other';

export interface ExtractionInput {
  readonly filePath: string;
  readonly language: ExtractionLanguage;
  readonly content: string;
  readonly automationKey?: string;
  readonly targetAutomationKeys?: readonly string[];
  readonly locale: 'es' | 'en';
  readonly declarationCountHint?: number;
  readonly requestSuiteSummary?: boolean;
}

export interface TokenUsage {
  readonly promptTokens: number;
  readonly candidatesTokens: number;
  readonly totalTokens: number;
}

export type ProviderUnavailableReason =
  | 'not-configured'
  | 'invalid-credentials'
  | 'rate-limited'
  | 'provider-overloaded'
  | 'empty-response'
  | 'invalid-json-response'
  | 'schema-violation'
  | 'unknown-provider-error';

export type ExtractionOutcome =
  | {
      kind: 'extracted';
      cases: readonly ExtractedCase[];
      suite: ExtractedSuite | null;
      usage: TokenUsage;
    }
  | { kind: 'no-tests-found' }
  | {
      kind: 'provider-unavailable';
      reason: ProviderUnavailableReason;
      /** Whether a retry (with backoff) is worth attempting, vs. a permanent failure. */
      retryable: boolean;
    };

export interface SuiteSummaryCaseInput {
  readonly title: string;
  readonly objective: string;
}

export interface SuiteSummaryInput {
  readonly suiteName: string;
  readonly cases: readonly SuiteSummaryCaseInput[];
  readonly locale: 'es' | 'en';
}

export type SuiteSummaryOutcome =
  | { kind: 'summarized'; suite: SuiteSummary; usage: TokenUsage }
  | {
      kind: 'provider-unavailable';
      reason: ProviderUnavailableReason;
      /** Whether a retry (with backoff) is worth attempting, vs. a permanent failure. */
      retryable: boolean;
    };

export interface TestCaseExtractor {
  extract(
    input: ExtractionInput,
    signal?: AbortSignal,
  ): Promise<ExtractionOutcome>;
  summarizeSuite(input: SuiteSummaryInput): Promise<SuiteSummaryOutcome>;
}

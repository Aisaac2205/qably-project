import { z } from 'zod';
import { normalizeTitleForComparison } from '@qably/types';
import { truncateTo } from '../../common/text/truncate-to';
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

export const shortText = (max: number) => z.string().trim().min(1).max(max);

const automationKeyText = z
  .string()
  .trim()
  .min(1)
  .transform((value) => truncateTo(value, AUTOMATION_KEY_MAX_LENGTH));

const LEADING_ORDINAL = /^\d+[.)]\s*/;

const listItem = (max: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(LEADING_ORDINAL, ''))
    .pipe(shortText(max));

export const extractedCaseObjectSchema = z.object({
  automationKey: automationKeyText,
  title: shortText(120),
  objective: shortText(500),
  preconditions: z.array(listItem(300)).max(10).default([]),
  steps: z.array(listItem(300)).min(1).max(20),
  expectedResult: shortText(500),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  sourceExcerpt: shortText(600),
  observations: z.array(shortText(200)).max(5).optional(),
});

export const extractedCaseSchema = extractedCaseObjectSchema
  .extend({
    targetRef: z.unknown().transform(parseTargetRef).optional(),
  })
  .refine(
    (data) =>
      normalizeTitleForComparison(data.title) !==
      normalizeTitleForComparison(data.automationKey),
    {
      message: 'title must be different from the raw automationKey',
      path: ['title'],
    },
  );

export const extractedSuiteSchema = z.object({
  title: shortText(80),
  description: shortText(300),
  tags: z.array(shortText(40)).max(20).default([]),
});

export const suiteSummarySchema = z.object({
  title: shortText(80),
  description: shortText(300),
  tags: z.array(shortText(40)).min(1).max(20),
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

import { z } from 'zod';

export const MAX_SOURCE_CONTENT_LENGTH = 60_000;
export const MAX_EXTRACTED_CASES = 20;

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const extractedCaseSchema = z.object({
  automationKey: shortText(120),
  title: shortText(120),
  objective: shortText(500),
  preconditions: z.array(shortText(300)).max(10).default([]),
  steps: z.array(shortText(300)).min(1).max(20),
  expectedResult: shortText(500),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  sourceExcerpt: shortText(600),
});

export const extractionOutputSchema = z.object({
  cases: z.array(extractedCaseSchema).max(MAX_EXTRACTED_CASES),
});

export type ExtractedCase = z.infer<typeof extractedCaseSchema>;

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
  readonly locale: 'es' | 'en';
}

export interface TokenUsage {
  readonly promptTokens: number;
  readonly candidatesTokens: number;
  readonly totalTokens: number;
}

export type ExtractionOutcome =
  | { kind: 'extracted'; cases: readonly ExtractedCase[]; usage: TokenUsage }
  | { kind: 'no-tests-found' }
  | { kind: 'provider-unavailable'; reason: string };

export interface TestCaseExtractor {
  extract(
    input: ExtractionInput,
    signal?: AbortSignal,
  ): Promise<ExtractionOutcome>;
}

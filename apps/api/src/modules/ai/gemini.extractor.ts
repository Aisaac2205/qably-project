import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { GEMINI_CLIENT } from './ai.tokens';
import {
  buildFileContentTurn,
  buildSystemInstruction,
} from './extraction-prompt';
import {
  buildSuiteSummaryInstruction,
  buildSuiteSummaryTurn,
} from './suite-summary-prompt';
import {
  extractedCaseSchema,
  extractedSuiteSchema,
  suiteSummarySchema,
  MAX_EXTRACTED_CASES,
  type ExtractedCase,
  type ExtractionInput,
  type ExtractionOutcome,
  type ProviderUnavailableReason,
  type SuiteSummaryInput,
  type SuiteSummaryOutcome,
  type TestCaseExtractor,
} from './extraction.contracts';

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const OVERLOAD_STATUS_CODES = [408, 500, 502, 503, 504];
const TIMEOUT_MS = 60_000;
const RETRY_ATTEMPTS = 3;
const TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 8192;

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    cases: {
      type: 'array',
      maxItems: MAX_EXTRACTED_CASES,
      items: {
        type: 'object',
        properties: {
          automationKey: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
          preconditions: {
            type: 'array',
            items: { type: 'string' },
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
          },
          expectedResult: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
          },
          sourceExcerpt: { type: 'string' },
          observations: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: [
          'automationKey',
          'title',
          'objective',
          'steps',
          'expectedResult',
          'priority',
          'sourceExcerpt',
        ],
      },
    },
    suite: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['title', 'description'],
    },
  },
  required: ['cases'],
} as const;

const envelopeSchema = z.object({
  cases: z.array(z.unknown()),
  suite: z.unknown().optional(),
});

export const SUITE_SUMMARY_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'description', 'tags'],
} as const;

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiGenerateContentResponse {
  text?: string;
  usageMetadata?: GeminiUsageMetadata;
}

export interface GeminiClient {
  models: {
    generateContent(
      params: Record<string, unknown>,
    ): Promise<GeminiGenerateContentResponse>;
  };
}

export function createGeminiClient(apiKey: string): GeminiClient {
  return new GoogleGenAI({ apiKey }) as unknown as GeminiClient;
}

@Injectable()
export class GeminiExtractor implements TestCaseExtractor {
  private readonly logger = new Logger(GeminiExtractor.name);
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GeminiClient,
    @InjectEnv() env: Env,
  ) {
    this.model = env.GEMINI_MODEL;
  }

  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildFileContentTurn({
          filePath: input.filePath,
          language: input.language,
          content: input.content,
          targetAutomationKeys: input.targetAutomationKeys,
        }),
        config: {
          systemInstruction: buildSystemInstruction(
            input.locale,
            (input.targetAutomationKeys?.length ?? 0) > 0,
            input.declarationCountHint,
          ),
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          httpOptions: {
            timeout: TIMEOUT_MS,
            retryOptions: {
              attempts: RETRY_ATTEMPTS,
              httpStatusCodes: RETRYABLE_STATUS_CODES,
            },
          },
        },
      });

      return this.toOutcome(response, input.filePath);
    } catch (error) {
      return this.mapThrownError(error, input.filePath, 'extraction');
    }
  }

  async summarizeSuite(input: SuiteSummaryInput): Promise<SuiteSummaryOutcome> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildSuiteSummaryTurn({
          suiteName: input.suiteName,
          cases: input.cases,
        }),
        config: {
          systemInstruction: buildSuiteSummaryInstruction(input.locale),
          responseMimeType: 'application/json',
          responseJsonSchema: SUITE_SUMMARY_RESPONSE_JSON_SCHEMA,
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          httpOptions: {
            timeout: TIMEOUT_MS,
            retryOptions: {
              attempts: RETRY_ATTEMPTS,
              httpStatusCodes: RETRYABLE_STATUS_CODES,
            },
          },
        },
      });

      return this.toSuiteSummaryOutcome(response, input.suiteName);
    } catch (error) {
      return this.mapThrownError(error, input.suiteName, 'suite summary');
    }
  }

  private mapThrownError(
    error: unknown,
    context: string,
    what: 'extraction' | 'suite summary',
  ): {
    kind: 'provider-unavailable';
    reason: ProviderUnavailableReason;
    retryable: boolean;
  } {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      this.logger.warn(
        `Gemini rejected the ${what} request for ${context}: invalid credentials`,
      );
      return {
        kind: 'provider-unavailable',
        reason: 'invalid-credentials',
        retryable: false,
      };
    }

    if (error instanceof ApiError && error.status === 429) {
      this.logger.warn(
        `Gemini rate-limited the ${what} request for ${context}`,
      );
      return {
        kind: 'provider-unavailable',
        reason: 'rate-limited',
        retryable: true,
      };
    }

    if (
      error instanceof ApiError &&
      OVERLOAD_STATUS_CODES.includes(error.status)
    ) {
      this.logger.error(
        `Gemini returned ${error.status} for the ${what} request for ${context} after its own internal retries`,
      );
      return {
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      };
    }

    // Anything else (network failure, an ApiError with an unexpected status,
    // a non-Error throw) is unclassified — log the raw detail server-side for
    // debugging, but never let it leak into the reason field: that field ends
    // up stored as an ExtractedProposal.objective and shown to the user, so it
    // must always be one of the known ProviderUnavailableReason values.
    const rawDetail = error instanceof Error ? error.message : 'unknown-error';
    this.logger.error(`Gemini ${what} failed for ${context}: ${rawDetail}`);
    return {
      kind: 'provider-unavailable',
      reason: 'unknown-provider-error',
      retryable: false,
    };
  }

  private toOutcome(
    response: GeminiGenerateContentResponse,
    filePath: string,
  ): ExtractionOutcome {
    if (response.text === undefined) {
      return {
        kind: 'provider-unavailable',
        reason: 'empty-response',
        retryable: false,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return {
        kind: 'provider-unavailable',
        reason: 'invalid-json-response',
        retryable: false,
      };
    }

    const envelope = envelopeSchema.safeParse(parsed);

    if (!envelope.success) {
      this.logger.warn(`Gemini response for ${filePath} had no cases array`);
      return {
        kind: 'provider-unavailable',
        reason: 'schema-violation',
        retryable: false,
      };
    }

    const validCases: ExtractedCase[] = [];
    let dropped = 0;

    for (const raw of envelope.data.cases) {
      const result = extractedCaseSchema.safeParse(raw);
      if (result.success) {
        validCases.push(result.data);
      } else {
        dropped += 1;
      }
    }

    if (dropped > 0) {
      this.logger.warn(
        `Gemini response for ${filePath} dropped ${dropped} invalid case(s)`,
      );
    }

    if (validCases.length === 0) return { kind: 'no-tests-found' };

    const usage = response.usageMetadata ?? {};
    const suite = extractedSuiteSchema.safeParse(envelope.data.suite);

    return {
      kind: 'extracted',
      cases: validCases,
      suite: suite.success ? suite.data : null,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        candidatesTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
    };
  }

  private toSuiteSummaryOutcome(
    response: GeminiGenerateContentResponse,
    suiteName: string,
  ): SuiteSummaryOutcome {
    if (response.text === undefined) {
      return {
        kind: 'provider-unavailable',
        reason: 'empty-response',
        retryable: false,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return {
        kind: 'provider-unavailable',
        reason: 'invalid-json-response',
        retryable: false,
      };
    }

    const result = suiteSummarySchema.safeParse(parsed);

    if (!result.success) {
      this.logger.warn(
        `Gemini suite summary response for ${suiteName} failed schema validation`,
      );
      return {
        kind: 'provider-unavailable',
        reason: 'schema-violation',
        retryable: false,
      };
    }

    const usage = response.usageMetadata ?? {};

    return {
      kind: 'summarized',
      suite: result.data,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        candidatesTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
    };
  }
}

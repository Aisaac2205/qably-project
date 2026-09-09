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
  extractedCaseSchema,
  MAX_EXTRACTED_CASES,
  type ExtractedCase,
  type ExtractionInput,
  type ExtractionOutcome,
  type TestCaseExtractor,
} from './extraction.contracts';

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const TIMEOUT_MS = 60_000;
const RETRY_ATTEMPTS = 3;
const TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 8192;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    cases: {
      type: 'array',
      maxItems: MAX_EXTRACTED_CASES,
      items: {
        type: 'object',
        properties: {
          automationKey: { type: 'string', maxLength: 120 },
          title: { type: 'string', maxLength: 120 },
          objective: { type: 'string', maxLength: 500 },
          preconditions: {
            type: 'array',
            maxItems: 10,
            items: { type: 'string', maxLength: 300 },
          },
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: { type: 'string', maxLength: 300 },
          },
          expectedResult: { type: 'string', maxLength: 500 },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
          },
          sourceExcerpt: { type: 'string', maxLength: 600 },
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
  },
  required: ['cases'],
} as const;

const envelopeSchema = z.object({ cases: z.array(z.unknown()) });

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
          systemInstruction: buildSystemInstruction(input.locale),
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
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        this.logger.warn(
          `Gemini rejected the request for ${input.filePath}: invalid credentials`,
        );
        return { kind: 'provider-unavailable', reason: 'invalid-credentials' };
      }

      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(
        `Gemini extraction failed for ${input.filePath}: ${reason}`,
      );
      return { kind: 'provider-unavailable', reason };
    }
  }

  private toOutcome(
    response: GeminiGenerateContentResponse,
    filePath: string,
  ): ExtractionOutcome {
    if (response.text === undefined) {
      return { kind: 'provider-unavailable', reason: 'empty-response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      return { kind: 'provider-unavailable', reason: 'invalid-json-response' };
    }

    const envelope = envelopeSchema.safeParse(parsed);

    if (!envelope.success) {
      this.logger.warn(`Gemini response for ${filePath} had no cases array`);
      return { kind: 'provider-unavailable', reason: 'schema-violation' };
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

    return {
      kind: 'extracted',
      cases: validCases,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        candidatesTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
    };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiError } from '@google/genai';
import { z } from 'zod';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { GEMINI_CLIENT } from '../ai/ai.tokens';
import type { TokenUsage } from '../ai/extraction.contracts';
import type { GeminiClient } from '../ai/gemini.extractor';
import {
  buildChatSystemInstruction,
  type ChatProjectContext,
} from './chat-prompt';
import {
  MAX_REPLY_LENGTH,
  MAX_SUGGESTED_CASES,
  suggestedCaseSchema,
  type ChatRole,
  type SuggestedCase,
} from './chat.contracts';

export interface ChatHistoryEntry {
  role: ChatRole;
  content: string;
}

export interface ChatReplyInput {
  locale: 'es' | 'en';
  message: string;
  history: ChatHistoryEntry[];
  context: ChatProjectContext;
}

export type ChatReplyOutcome =
  | {
      kind: 'replied';
      reply: string;
      cases: SuggestedCase[];
      usage: TokenUsage;
    }
  | { kind: 'provider-unavailable'; reason: string };

export interface ChatAssistant {
  reply(input: ChatReplyInput): Promise<ChatReplyOutcome>;
}

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const TIMEOUT_MS = 60_000;
const RETRY_ATTEMPTS = 3;
const TEMPERATURE = 0.4;
const MAX_OUTPUT_TOKENS = 4096;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', maxLength: MAX_REPLY_LENGTH },
    cases: {
      type: 'array',
      maxItems: MAX_SUGGESTED_CASES,
      items: {
        type: 'object',
        properties: {
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
        },
        required: ['title', 'objective', 'steps', 'expectedResult', 'priority'],
      },
    },
  },
  required: ['reply', 'cases'],
} as const;

const envelopeSchema = z.object({
  reply: z.string().trim().min(1).max(MAX_REPLY_LENGTH),
  cases: z.array(z.unknown()).max(MAX_SUGGESTED_CASES),
});

function toContents(
  history: ChatHistoryEntry[],
  message: string,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const turns = history.map((entry) => ({
    role: entry.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: entry.content }],
  }));
  return [...turns, { role: 'user', parts: [{ text: message }] }];
}

@Injectable()
export class GeminiChatAssistant implements ChatAssistant {
  private readonly logger = new Logger(GeminiChatAssistant.name);
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GeminiClient,
    @InjectEnv() env: Env,
  ) {
    this.model = env.GEMINI_MODEL;
  }

  async reply(input: ChatReplyInput): Promise<ChatReplyOutcome> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: toContents(input.history, input.message),
        config: {
          systemInstruction: buildChatSystemInstruction(
            input.locale,
            input.context,
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

      return this.toOutcome(response.text, response.usageMetadata);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        this.logger.warn(
          'Gemini rejected the chat request: invalid credentials',
        );
        return { kind: 'provider-unavailable', reason: 'invalid-credentials' };
      }
      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(`Gemini chat request failed: ${reason}`);
      return { kind: 'provider-unavailable', reason };
    }
  }

  private toOutcome(
    text: string | undefined,
    usageMetadata:
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        }
      | undefined,
  ): ChatReplyOutcome {
    if (text === undefined) {
      return { kind: 'provider-unavailable', reason: 'empty-response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { kind: 'provider-unavailable', reason: 'invalid-json-response' };
    }

    const envelope = envelopeSchema.safeParse(parsed);
    if (!envelope.success) {
      return { kind: 'provider-unavailable', reason: 'schema-violation' };
    }

    const cases: SuggestedCase[] = [];
    for (const raw of envelope.data.cases) {
      const result = suggestedCaseSchema.safeParse(raw);
      if (result.success) cases.push(result.data);
    }

    const usage = usageMetadata ?? {};
    return {
      kind: 'replied',
      reply: envelope.data.reply,
      cases,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        candidatesTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
    };
  }
}

@Injectable()
export class DisabledChatAssistant implements ChatAssistant {
  reply(): Promise<ChatReplyOutcome> {
    return Promise.resolve({
      kind: 'provider-unavailable',
      reason: 'GEMINI_API_KEY not configured',
    });
  }
}

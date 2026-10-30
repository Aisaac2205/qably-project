import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiError } from '@google/genai';
import { z } from 'zod';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { GEMINI_CLIENT } from '../ai/ai.tokens';
import type { TokenUsage } from '../ai/extraction.contracts';
import type {
  GeminiStreamingClient,
  GeminiUsageMetadata,
} from '../ai/gemini.extractor';
import { createReplyDeltaExtractor } from './chat-reply-stream';
import {
  buildCaseContextAcknowledgement,
  buildChatSystemInstruction,
  buildProjectContextAcknowledgement,
  buildProjectContextTurn,
  type ChatProjectContext,
} from './chat-prompt';
import {
  groundingDeclarationSchema,
  type GroundingDeclaration,
} from './chat-grounding';
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
  caseContext?: string;
}

export type ChatReplyOutcome =
  | {
      kind: 'replied';
      reply: string;
      cases: SuggestedCase[];
      grounding: GroundingDeclaration;
      usage: TokenUsage;
    }
  | { kind: 'provider-unavailable'; reason: string };

/**
 * A streamed reply: zero or more deltas of reply text and case previews, in
 * any order, then exactly one outcome. The outcome is authoritative; the
 * deltas and cases only preview it, and a previewed case is always one of
 * the outcome's own `cases`, at the same index.
 */
export type ChatReplyStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'case'; index: number; case: SuggestedCase }
  | { type: 'outcome'; outcome: ChatReplyOutcome };

export interface ChatReplyStreamOptions {
  /** Aborts the provider request when the caller goes away. */
  signal: AbortSignal;
}

export interface ChatAssistant {
  reply(input: ChatReplyInput): Promise<ChatReplyOutcome>;
  replyStream(
    input: ChatReplyInput,
    options: ChatReplyStreamOptions,
  ): AsyncGenerator<ChatReplyStreamEvent>;
}

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const TIMEOUT_MS = 60_000;
const RETRY_ATTEMPTS = 3;
const TEMPERATURE = 0.4;
const MAX_OUTPUT_TOKENS = 4096;

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    cases: {
      type: 'array',
      maxItems: MAX_SUGGESTED_CASES,
      items: {
        type: 'object',
        properties: {
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
          targetTestCaseId: { type: 'string' },
          evidencePath: { type: 'string' },
        },
        required: ['title', 'objective', 'steps', 'expectedResult', 'priority'],
      },
    },
    grounding: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['grounded', 'insufficient'] },
        references: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: {
                type: 'string',
                enum: [
                  'source-excerpt',
                  'code-change',
                  'review',
                  'attached-file',
                ],
              },
              id: { type: 'string' },
            },
            required: ['kind', 'id'],
          },
        },
      },
      required: ['status'],
    },
  },
  required: ['reply', 'cases', 'grounding'],
} as const;

const envelopeSchema = z.object({
  reply: z.string().trim().min(1).max(MAX_REPLY_LENGTH),
  cases: z.array(z.unknown()).max(MAX_SUGGESTED_CASES),
  grounding: groundingDeclarationSchema,
});

type ContentTurn = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

function toContents(input: ChatReplyInput): ContentTurn[] {
  const history: ContentTurn[] = input.history.map((entry) => ({
    role: entry.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: entry.content }],
  }));

  const caseContextTurns: ContentTurn[] =
    input.caseContext === undefined || input.caseContext === ''
      ? []
      : [
          { role: 'user', parts: [{ text: input.caseContext }] },
          {
            role: 'model',
            parts: [{ text: buildCaseContextAcknowledgement(input.locale) }],
          },
        ];

  return [
    { role: 'user', parts: [{ text: buildProjectContextTurn(input.context) }] },
    {
      role: 'model',
      parts: [{ text: buildProjectContextAcknowledgement(input.locale) }],
    },
    ...caseContextTurns,
    ...history,
    { role: 'user', parts: [{ text: input.message }] },
  ];
}

@Injectable()
export class GeminiChatAssistant implements ChatAssistant {
  private readonly logger = new Logger(GeminiChatAssistant.name);
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GeminiStreamingClient,
    @InjectEnv() env: Env,
  ) {
    this.model = env.GEMINI_MODEL;
  }

  async reply(input: ChatReplyInput): Promise<ChatReplyOutcome> {
    try {
      const response = await this.client.models.generateContent(
        this.request(input),
      );

      return this.toOutcome(response.text, response.usageMetadata);
    } catch (error) {
      return this.toFailure(error);
    }
  }

  /**
   * Same request as reply, streamed. The text is accumulated and parsed as a
   * whole at the end, exactly like reply; the deltas are only a preview.
   */
  async *replyStream(
    input: ChatReplyInput,
    options: ChatReplyStreamOptions,
  ): AsyncGenerator<ChatReplyStreamEvent> {
    const extractor = createReplyDeltaExtractor();
    let text: string | undefined;
    let usageMetadata: GeminiUsageMetadata | undefined;

    try {
      const stream = await this.client.models.generateContentStream(
        this.request(input, options.signal),
      );

      for await (const chunk of stream) {
        if (chunk.usageMetadata !== undefined) {
          usageMetadata = chunk.usageMetadata;
        }
        const piece = chunk.text;
        if (piece === undefined || piece === '') continue;

        text = (text ?? '') + piece;
        const { replyDelta, cases } = extractor.push(piece);
        if (replyDelta !== '') yield { type: 'delta', text: replyDelta };
        for (const entry of cases) {
          yield { type: 'case', index: entry.index, case: entry.case };
        }
      }
    } catch (error) {
      if (options.signal.aborted) {
        this.logger.debug('Gemini chat stream aborted by the caller');
        yield {
          type: 'outcome',
          outcome: { kind: 'provider-unavailable', reason: 'aborted' },
        };
        return;
      }
      yield { type: 'outcome', outcome: this.toFailure(error) };
      return;
    }

    yield { type: 'outcome', outcome: this.toOutcome(text, usageMetadata) };
  }

  private request(
    input: ChatReplyInput,
    signal?: AbortSignal,
  ): Record<string, unknown> {
    return {
      model: this.model,
      contents: toContents(input),
      config: {
        systemInstruction: buildChatSystemInstruction(input.locale),
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
        ...(signal === undefined ? {} : { abortSignal: signal }),
      },
    };
  }

  private toFailure(error: unknown): ChatReplyOutcome {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      this.logger.warn('Gemini rejected the chat request: invalid credentials');
      return { kind: 'provider-unavailable', reason: 'invalid-credentials' };
    }
    const reason = error instanceof Error ? error.message : 'unknown-error';
    this.logger.error(`Gemini chat request failed: ${reason}`);
    return { kind: 'provider-unavailable', reason };
  }

  private toOutcome(
    text: string | undefined,
    usageMetadata: GeminiUsageMetadata | undefined,
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
      grounding: envelope.data.grounding,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        candidatesTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
    };
  }
}

const NOT_CONFIGURED: ChatReplyOutcome = {
  kind: 'provider-unavailable',
  reason: 'GEMINI_API_KEY not configured',
};

@Injectable()
export class DisabledChatAssistant implements ChatAssistant {
  reply(): Promise<ChatReplyOutcome> {
    return Promise.resolve(NOT_CONFIGURED);
  }

  async *replyStream(): AsyncGenerator<ChatReplyStreamEvent> {
    yield { type: 'outcome', outcome: await this.reply() };
  }
}

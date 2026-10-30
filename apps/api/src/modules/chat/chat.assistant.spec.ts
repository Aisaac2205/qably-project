import { Logger } from '@nestjs/common';
import { ApiError } from '@google/genai';
import type { Env } from '../../config/env';
import type {
  GeminiGenerateContentResponse,
  GeminiStreamingClient,
} from '../ai/gemini.extractor';
import {
  DisabledChatAssistant,
  GeminiChatAssistant,
  type ChatReplyInput,
  type ChatReplyStreamEvent,
} from './chat.assistant';
import {
  PROJECT_DATA_CLOSE,
  PROJECT_DATA_OPEN,
  buildChatSystemInstruction,
  buildProjectContextAcknowledgement,
} from './chat-prompt';

type Turn = { role: 'user' | 'model'; parts: Array<{ text: string }> };

function env(): Env {
  return { GEMINI_MODEL: 'gemini-x' } as Env;
}

function input(overrides: Partial<ChatReplyInput> = {}): ChatReplyInput {
  return {
    locale: 'es',
    message: 'Which flows are uncovered?',
    history: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ],
    context: {
      projectName: 'Checkout',
      suites: [{ name: 'Login', cases: 12 }],
      caseTitles: ['Rejects an expired card'],
      recentRuns: [{ name: 'nightly', status: 'passed' }],
    },
    ...overrides,
  };
}

function unusedStream(): Promise<
  AsyncGenerator<GeminiGenerateContentResponse>
> {
  return Promise.reject(new Error('generateContentStream was not expected'));
}

function capture() {
  const received: { params: Record<string, unknown> } = { params: {} };
  const client: GeminiStreamingClient = {
    models: {
      generateContentStream: unusedStream,
      generateContent: (params) => {
        received.params = params;
        return Promise.resolve({
          text: JSON.stringify({
            reply: 'ok',
            cases: [],
            grounding: { status: 'insufficient' },
          }),
        });
      },
    },
  };
  return { received, client };
}

describe('GeminiChatAssistant', () => {
  it('keeps project data out of the system instruction', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(input());

    const config = received.params.config as Record<string, unknown>;
    expect(config.systemInstruction).toBe(buildChatSystemInstruction('es'));
    expect(config.systemInstruction as string).not.toContain('Checkout');
  });

  it('sends the project data as the first delimited user turn', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(input());

    const contents = received.params.contents as Turn[];
    expect(contents[0].role).toBe('user');
    expect(contents[0].parts[0].text).toContain(PROJECT_DATA_OPEN);
    expect(contents[0].parts[0].text).toContain(PROJECT_DATA_CLOSE);
    expect(contents[0].parts[0].text).toContain('Checkout');
  });

  it('acknowledges the data block in the answering locale', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(input({ locale: 'en' }));

    const contents = received.params.contents as Turn[];
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts[0].text).toBe(
      buildProjectContextAcknowledgement('en'),
    );
  });

  it('sends the case context as a delimited turn followed by its own acknowledgement, after the project data ack and before history', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(
      input({
        caseContext:
          '<<<CASE_CONTEXT>>>\nCase ID: case-1\n<<<END_CASE_CONTEXT>>>',
      }),
    );

    const contents = received.params.contents as Turn[];
    expect(contents.map((turn) => turn.role)).toEqual([
      'user',
      'model',
      'user',
      'model',
      'user',
      'model',
      'user',
    ]);
    expect(contents[2].parts[0].text).toContain('<<<CASE_CONTEXT>>>');
    expect(contents[3].role).toBe('model');
  });

  it('omits the case context turns entirely when no case is attached', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(input());

    const contents = received.params.contents as Turn[];
    expect(
      contents.some((turn) => turn.parts[0].text.includes('CASE_CONTEXT')),
    ).toBe(false);
  });

  it('accepts an optional targetTestCaseId per case in the response schema, unbounded in length', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(input());

    const config = received.params.config as {
      responseJsonSchema: {
        properties: {
          cases: {
            items: { properties: Record<string, { maxLength?: number }> };
          };
        };
      };
    };
    const targetField =
      config.responseJsonSchema.properties.cases.items.properties
        .targetTestCaseId;
    expect(targetField).toBeDefined();
    expect(targetField.maxLength).toBeUndefined();
  });

  it('keeps the history after the data turns and the message last', async () => {
    const { received, client } = capture();

    await new GeminiChatAssistant(client, env()).reply(input());

    const contents = received.params.contents as Turn[];
    expect(contents.map((turn) => turn.role)).toEqual([
      'user',
      'model',
      'user',
      'model',
      'user',
    ]);
    expect(contents[2].parts[0].text).toBe('hello');
    expect(contents[3].parts[0].text).toBe('hi');
    expect(contents[4].parts[0].text).toBe('Which flows are uncovered?');
  });

  it('forwards the parsed grounding declaration on a successful reply', async () => {
    const client: GeminiStreamingClient = {
      models: {
        generateContentStream: unusedStream,
        generateContent: () =>
          Promise.resolve({
            text: JSON.stringify({
              reply: 'ok',
              cases: [],
              grounding: {
                status: 'grounded',
                references: [{ kind: 'source-excerpt', id: 'case-1' }],
              },
            }),
          }),
      },
    };

    const outcome = await new GeminiChatAssistant(client, env()).reply(input());

    expect(outcome).toEqual({
      kind: 'replied',
      reply: 'ok',
      cases: [],
      grounding: {
        status: 'grounded',
        references: [{ kind: 'source-excerpt', id: 'case-1' }],
      },
      usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
    });
  });

  it('treats a response missing the grounding declaration as a schema violation', async () => {
    const client: GeminiStreamingClient = {
      models: {
        generateContentStream: unusedStream,
        generateContent: () =>
          Promise.resolve({
            text: JSON.stringify({ reply: 'ok', cases: [] }),
          }),
      },
    };

    const outcome = await new GeminiChatAssistant(client, env()).reply(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
    });
  });

  it('treats a grounded declaration citing an unbounded number of references as a schema violation', async () => {
    const references = Array.from({ length: 11 }, (_, index) => ({
      kind: 'source-excerpt' as const,
      id: `case-${index}`,
    }));
    const client: GeminiStreamingClient = {
      models: {
        generateContentStream: unusedStream,
        generateContent: () =>
          Promise.resolve({
            text: JSON.stringify({
              reply: 'ok',
              cases: [],
              grounding: { status: 'grounded', references },
            }),
          }),
      },
    };

    const outcome = await new GeminiChatAssistant(client, env()).reply(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
    });
  });
});

async function* chunks(
  ...responses: GeminiGenerateContentResponse[]
): AsyncGenerator<GeminiGenerateContentResponse> {
  for (const response of responses) {
    await Promise.resolve();
    yield response;
  }
}

function streamingClient(
  generateContentStream: GeminiStreamingClient['models']['generateContentStream'],
): GeminiStreamingClient {
  return {
    models: {
      generateContent: () =>
        Promise.reject(new Error('generateContent was not expected')),
      generateContentStream,
    },
  };
}

async function collect(
  stream: AsyncGenerator<ChatReplyStreamEvent>,
): Promise<ChatReplyStreamEvent[]> {
  const events: ChatReplyStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('GeminiChatAssistant.replyStream', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('streams the reply text as deltas and ends with the parsed outcome and the usage of the last chunk', async () => {
    const client = streamingClient(() =>
      Promise.resolve(
        chunks(
          { text: '{"reply":"Hel' },
          { text: 'lo","cases":[],"grounding":{"status":"insufficient"}}' },
          {
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              totalTokenCount: 15,
            },
          },
        ),
      ),
    );

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: new AbortController().signal,
      }),
    );

    expect(events).toEqual([
      { type: 'delta', text: 'Hel' },
      { type: 'delta', text: 'lo' },
      {
        type: 'outcome',
        outcome: {
          kind: 'replied',
          reply: 'Hello',
          cases: [],
          grounding: { status: 'insufficient' },
          usage: { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
        },
      },
    ]);
  });

  it('streams a case preview as soon as its element closes, before the reply closes or the outcome arrives', async () => {
    const suggestedCase = {
      title: 'Rejects an expired card',
      objective: 'Confirm expired cards are refused',
      preconditions: [],
      steps: ['Open checkout'],
      expectedResult: 'The payment is refused',
      priority: 'high',
    };
    const client = streamingClient(() =>
      Promise.resolve(
        chunks(
          { text: '{"reply":"Here","cases":[' },
          { text: JSON.stringify(suggestedCase) },
          { text: '],"grounding":{"status":"insufficient"}}' },
        ),
      ),
    );

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: new AbortController().signal,
      }),
    );

    expect(events).toEqual([
      { type: 'delta', text: 'Here' },
      { type: 'case', index: 0, case: suggestedCase },
      {
        type: 'outcome',
        outcome: {
          kind: 'replied',
          reply: 'Here',
          cases: [suggestedCase],
          grounding: { status: 'insufficient' },
          usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        },
      },
    ]);
  });

  it('sends the same request as a plain reply, plus the abort signal', async () => {
    const plain = capture();
    await new GeminiChatAssistant(plain.client, env()).reply(input());
    let streamed: Record<string, unknown> = {};
    const client = streamingClient((params) => {
      streamed = params;
      return Promise.resolve(
        chunks({
          text: '{"reply":"ok","cases":[],"grounding":{"status":"insufficient"}}',
        }),
      );
    });
    const signal = new AbortController().signal;

    await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), { signal }),
    );

    expect(streamed.contents).toEqual(plain.received.params.contents);
    expect(streamed.config).toEqual({
      ...(plain.received.params.config as Record<string, unknown>),
      abortSignal: signal,
    });
  });

  it('reports a credentials rejection as provider-unavailable, like a plain reply', async () => {
    const client = streamingClient(() =>
      Promise.reject(new ApiError({ message: 'invalid key', status: 401 })),
    );

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: new AbortController().signal,
      }),
    );

    expect(events).toEqual([
      {
        type: 'outcome',
        outcome: {
          kind: 'provider-unavailable',
          reason: 'invalid-credentials',
        },
      },
    ]);
  });

  it('reports a failure in the middle of the stream as provider-unavailable after the deltas already sent', async () => {
    async function* broken(): AsyncGenerator<GeminiGenerateContentResponse> {
      await Promise.resolve();
      yield { text: '{"reply":"Hel' };
      throw new Error('socket hang up');
    }
    const client = streamingClient(() => Promise.resolve(broken()));

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: new AbortController().signal,
      }),
    );

    expect(events).toEqual([
      { type: 'delta', text: 'Hel' },
      {
        type: 'outcome',
        outcome: { kind: 'provider-unavailable', reason: 'socket hang up' },
      },
    ]);
  });

  it('validates the complete envelope at the end of the stream, like a plain reply', async () => {
    const client = streamingClient(() =>
      Promise.resolve(
        chunks({ text: '{"reply":"ok",' }, { text: '"cases":[]}' }),
      ),
    );

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: new AbortController().signal,
      }),
    );

    expect(events.at(-1)).toEqual({
      type: 'outcome',
      outcome: { kind: 'provider-unavailable', reason: 'schema-violation' },
    });
  });

  it('reports a stream without any text as an empty response', async () => {
    const client = streamingClient(() => Promise.resolve(chunks()));

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: new AbortController().signal,
      }),
    );

    expect(events).toEqual([
      {
        type: 'outcome',
        outcome: { kind: 'provider-unavailable', reason: 'empty-response' },
      },
    ]);
  });

  it('reports a request aborted by the caller without logging it as a provider failure', async () => {
    const errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const controller = new AbortController();
    async function* interrupted(): AsyncGenerator<GeminiGenerateContentResponse> {
      await Promise.resolve();
      yield { text: '{"reply":"Hel' };
      controller.abort();
      throw new DOMException('This operation was aborted', 'AbortError');
    }
    const client = streamingClient(() => Promise.resolve(interrupted()));

    const events = await collect(
      new GeminiChatAssistant(client, env()).replyStream(input(), {
        signal: controller.signal,
      }),
    );

    expect(events.at(-1)).toEqual({
      type: 'outcome',
      outcome: { kind: 'provider-unavailable', reason: 'aborted' },
    });
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe('DisabledChatAssistant.replyStream', () => {
  it('reports the provider as unavailable without streaming any text', async () => {
    const events = await collect(new DisabledChatAssistant().replyStream());

    expect(events).toEqual([
      {
        type: 'outcome',
        outcome: {
          kind: 'provider-unavailable',
          reason: 'GEMINI_API_KEY not configured',
        },
      },
    ]);
  });
});

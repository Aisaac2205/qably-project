import type { Env } from '../../config/env';
import type { GeminiClient } from '../ai/gemini.extractor';
import { GeminiChatAssistant, type ChatReplyInput } from './chat.assistant';
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

function capture() {
  const received: { params: Record<string, unknown> } = { params: {} };
  const client: GeminiClient = {
    models: {
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
    const client: GeminiClient = {
      models: {
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
    const client: GeminiClient = {
      models: {
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
    const client: GeminiClient = {
      models: {
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

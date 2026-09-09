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
          text: JSON.stringify({ reply: 'ok', cases: [] }),
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
});

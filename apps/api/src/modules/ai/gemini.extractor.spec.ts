import { ApiError } from '@google/genai';
import type { Env } from '../../config/env';
import type { ExtractionInput } from './extraction.contracts';
import {
  FILE_CONTENT_CLOSE,
  FILE_CONTENT_OPEN,
  buildSystemInstruction,
} from './extraction-prompt';
import { GeminiExtractor, type GeminiClient } from './gemini.extractor';

function env(overrides: Partial<Env> = {}): Env {
  return { GEMINI_MODEL: 'gemini-2.5-flash-lite', ...overrides } as Env;
}

function input(overrides: Partial<ExtractionInput> = {}): ExtractionInput {
  return {
    filePath: 'src/cart.spec.ts',
    language: 'typescript',
    content: "it('adds an item', () => {})",
    locale: 'en',
    ...overrides,
  };
}

function validRawCase(overrides: Record<string, unknown> = {}) {
  return {
    automationKey: 'Cart > adds an item',
    title: 'Adds an item to the cart',
    objective: 'Verify the cart total updates',
    preconditions: [],
    steps: ['Add one item', 'Read the total'],
    expectedResult: 'The total reflects the item price',
    priority: 'medium',
    sourceExcerpt: "it('adds an item', () => {})",
    ...overrides,
  };
}

function fakeClient(
  generateContent: GeminiClient['models']['generateContent'],
): GeminiClient {
  return { models: { generateContent } };
}

describe('GeminiExtractor', () => {
  it('returns an extracted outcome with usage when the model returns valid cases', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({ cases: [validRawCase()] }),
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'extracted',
      cases: [validRawCase()],
      usage: { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 },
    });
  });

  it('sends the configured model, locale system instruction and generation config', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(
      client,
      env({ GEMINI_MODEL: 'gemini-x' }),
    ).extract(input({ locale: 'es' }));

    expect(received.model).toBe('gemini-x');
    const config = received.config as Record<string, unknown>;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.temperature).toBe(0.2);
    expect(config.maxOutputTokens).toBe(8192);
    expect(config.systemInstruction).toBe(buildSystemInstruction('es'));
    expect(config.httpOptions).toEqual({
      timeout: 60_000,
      retryOptions: {
        attempts: 3,
        httpStatusCodes: [408, 429, 500, 502, 503, 504],
      },
    });
  });

  it('sends the file as delimited untrusted data, not as a bare string', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(client, env()).extract(
      input({ filePath: 'src/cart.spec.ts', content: "it('adds', () => {})" }),
    );

    const contents = received.contents as string;
    expect(contents).toContain('File: src/cart.spec.ts');
    expect(contents).toContain(FILE_CONTENT_OPEN);
    expect(contents).toContain(FILE_CONTENT_CLOSE);
    expect(contents).toContain("it('adds', () => {})");
  });

  it('sends a target-cases block only when the input carries target automation keys', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(client, env()).extract(
      input({ targetAutomationKeys: ['Cart > adds an item'] }),
    );

    const contents = received.contents as string;
    expect(contents).toContain('Cart > adds an item');
  });

  it('returns no-tests-found when the model returns an empty cases array', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({ cases: [] }),
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({ kind: 'no-tests-found' });
  });

  it('drops individually invalid cases without failing the whole batch', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({
          cases: [validRawCase(), validRawCase({ steps: [] })],
        }),
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind === 'extracted') {
      expect(outcome.cases).toHaveLength(1);
    }
  });

  it('returns no-tests-found when every case is individually invalid', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({ cases: [validRawCase({ steps: [] })] }),
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({ kind: 'no-tests-found' });
  });

  it('returns provider-unavailable when the response has no text', async () => {
    const client = fakeClient(() => Promise.resolve({}));

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'empty-response',
    });
  });

  it('returns provider-unavailable when the response text is not valid JSON', async () => {
    const client = fakeClient(() => Promise.resolve({ text: 'not json' }));

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'invalid-json-response',
    });
  });

  it('returns provider-unavailable when the payload has no cases array', async () => {
    const client = fakeClient(() =>
      Promise.resolve({ text: JSON.stringify({}) }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
    });
  });

  it('returns provider-unavailable without retrying when the API key is invalid', async () => {
    const client = fakeClient(() => {
      throw new ApiError({ message: 'invalid key', status: 401 });
    });

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'invalid-credentials',
    });
  });

  it('returns provider-unavailable with the error message for any other failure', async () => {
    const client = fakeClient(() => {
      throw new Error('network is down');
    });

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'network is down',
    });
  });
});

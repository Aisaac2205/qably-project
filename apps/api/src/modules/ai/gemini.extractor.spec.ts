import { ApiError } from '@google/genai';
import type { Env } from '../../config/env';
import type {
  ExtractionInput,
  SuiteSummaryInput,
} from './extraction.contracts';
import {
  FILE_CONTENT_CLOSE,
  FILE_CONTENT_OPEN,
  buildSystemInstruction,
} from './extraction-prompt';
import { buildSuiteSummaryInstruction } from './suite-summary-prompt';
import {
  GeminiExtractor,
  SUITE_SUMMARY_RESPONSE_JSON_SCHEMA,
  type GeminiClient,
} from './gemini.extractor';

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
      suite: null,
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

  it('tells the system instruction about the target-cases block only when targets are present', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(client, env()).extract(
      input({ locale: 'es', targetAutomationKeys: ['Cart > adds an item'] }),
    );

    const config = received.config as Record<string, unknown>;
    expect(config.systemInstruction).toBe(buildSystemInstruction('es', true));
    expect(config.systemInstruction).not.toBe(buildSystemInstruction('es'));
  });

  it('requests the suite summary bonus by default when targets are present', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(client, env()).extract(
      input({ locale: 'es', targetAutomationKeys: ['Cart > adds an item'] }),
    );

    const config = received.config as Record<string, unknown>;
    expect(config.systemInstruction).toBe(buildSystemInstruction('es', true));
  });

  it('drops the suite summary bonus when the caller says a standalone suite job already covers it', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(client, env()).extract(
      input({
        locale: 'es',
        targetAutomationKeys: ['Cart > adds an item'],
        requestSuiteSummary: false,
      }),
    );

    const config = received.config as Record<string, unknown>;
    expect(config.systemInstruction).toBe(
      buildSystemInstruction('es', true, undefined, false),
    );
    expect(config.systemInstruction).not.toBe(
      buildSystemInstruction('es', true),
    );
  });

  it('tells the system instruction the declaration count only when a hint is given', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({ text: JSON.stringify({ cases: [] }) });
    });

    await new GeminiExtractor(client, env()).extract(
      input({ locale: 'es', declarationCountHint: 5 }),
    );

    const config = received.config as Record<string, unknown>;
    expect(config.systemInstruction).toBe(
      buildSystemInstruction('es', false, 5),
    );
    expect(config.systemInstruction).not.toBe(buildSystemInstruction('es'));
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
      retryable: false,
    });
  });

  it('returns provider-unavailable when the response text is not valid JSON', async () => {
    const client = fakeClient(() => Promise.resolve({ text: 'not json' }));

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'invalid-json-response',
      retryable: false,
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
      retryable: false,
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
      retryable: false,
    });
  });

  it('returns provider-unavailable, retryable, and rate-limited when Gemini answers 429', async () => {
    const client = fakeClient(() => {
      throw new ApiError({ message: 'Too many requests', status: 429 });
    });

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'rate-limited',
      retryable: true,
    });
  });

  it.each([500, 502, 503, 504])(
    'returns provider-unavailable, retryable, and provider-overloaded when Gemini answers %i',
    async (status) => {
      const client = fakeClient(() => {
        throw new ApiError({ message: 'Service Unavailable', status });
      });

      const outcome = await new GeminiExtractor(client, env()).extract(input());

      expect(outcome).toEqual({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      });
    },
  );

  it('never leaks the raw error message as the reason for an unrecognized failure', async () => {
    const client = fakeClient(() => {
      throw new Error('network is down');
    });

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'unknown-provider-error',
      retryable: false,
    });
  });

  it('logs the raw error message server-side even though it never reaches the outcome', async () => {
    const client = fakeClient(() => {
      throw new Error('network is down');
    });
    const extractor = new GeminiExtractor(client, env());
    const errorSpy = jest.spyOn(extractor['logger'], 'error');

    await extractor.extract(input());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('network is down'),
    );
  });
});

describe('GeminiExtractor suite summary and observations', () => {
  it('passes a valid suite summary through and keeps observations on the case', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({
          cases: [
            { ...validRawCase(), observations: ['No assertion on the total'] },
          ],
          suite: { title: 'Carrito', description: 'Cubre el flujo de compra' },
        }),
        usageMetadata: {},
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;
    expect(outcome.suite).toEqual({
      title: 'Carrito',
      description: 'Cubre el flujo de compra',
      tags: [],
    });
    expect(outcome.cases[0].observations).toEqual([
      'No assertion on the total',
    ]);
  });

  it('passes proposed suite tags through', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({
          cases: [validRawCase()],
          suite: {
            title: 'Carrito',
            description: 'Cubre el flujo de compra',
            tags: ['pagos', 'carrito'],
          },
        }),
        usageMetadata: {},
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;
    expect(outcome.suite?.tags).toEqual(['pagos', 'carrito']);
  });

  it('reports no suite summary when the model omits it or sends an invalid one', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({ cases: [validRawCase()], suite: { title: '' } }),
        usageMetadata: {},
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).extract(input());

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;
    expect(outcome.suite).toBeNull();
  });
});

function suiteSummaryInput(overrides: Partial<SuiteSummaryInput> = {}) {
  return {
    suiteName: 'Checkout',
    cases: [
      { title: 'Adds an item', objective: 'Verify the cart accepts an item' },
    ],
    locale: 'en' as const,
    ...overrides,
  };
}

describe('GeminiExtractor.summarizeSuite', () => {
  it('returns a summarized outcome with usage when the model returns a valid suite', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({
          title: 'Checkout',
          description: 'Covers the checkout flow',
          tags: ['payments'],
        }),
        usageMetadata: {
          promptTokenCount: 40,
          candidatesTokenCount: 20,
          totalTokenCount: 60,
        },
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
      suiteSummaryInput(),
    );

    expect(outcome).toEqual({
      kind: 'summarized',
      suite: {
        title: 'Checkout',
        description: 'Covers the checkout flow',
        tags: ['payments'],
      },
      usage: { promptTokens: 40, candidatesTokens: 20, totalTokens: 60 },
    });
  });

  it('sends the configured model, locale system instruction and generation config', async () => {
    let received: Record<string, unknown> = {};
    const client = fakeClient((params) => {
      received = params;
      return Promise.resolve({
        text: JSON.stringify({
          title: 'Checkout',
          description: 'Covers the checkout flow',
          tags: ['payments'],
        }),
      });
    });

    await new GeminiExtractor(
      client,
      env({ GEMINI_MODEL: 'gemini-x' }),
    ).summarizeSuite(suiteSummaryInput({ locale: 'es' }));

    expect(received.model).toBe('gemini-x');
    const config = received.config as Record<string, unknown>;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.systemInstruction).toBe(buildSuiteSummaryInstruction('es'));
  });

  it('never puts a length limit or a nested item-count bound in the Gemini schema', () => {
    const json = JSON.stringify(SUITE_SUMMARY_RESPONSE_JSON_SCHEMA);

    expect(json).not.toContain('maxLength');
    expect(json).not.toContain('minItems');
    expect(json).not.toContain('maxItems');
  });

  it('requires title, description and tags in the Gemini schema', () => {
    expect(SUITE_SUMMARY_RESPONSE_JSON_SCHEMA.required).toEqual([
      'title',
      'description',
      'tags',
    ]);
  });

  it('drops a response whose tags array is empty, since a suite summary needs at least one tag', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({
          title: 'Checkout',
          description: 'Covers the checkout flow',
          tags: [],
        }),
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
      suiteSummaryInput(),
    );

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
      retryable: false,
    });
  });

  it('drops a response missing a required field', async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        text: JSON.stringify({ title: 'Checkout', tags: ['payments'] }),
      }),
    );

    const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
      suiteSummaryInput(),
    );

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
      retryable: false,
    });
  });

  it('returns provider-unavailable without retrying when the API key is invalid', async () => {
    const client = fakeClient(() => {
      throw new ApiError({ message: 'invalid key', status: 401 });
    });

    const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
      suiteSummaryInput(),
    );

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'invalid-credentials',
      retryable: false,
    });
  });

  it('returns provider-unavailable, retryable, and rate-limited when Gemini answers 429', async () => {
    const client = fakeClient(() => {
      throw new ApiError({ message: 'Too many requests', status: 429 });
    });

    const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
      suiteSummaryInput(),
    );

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'rate-limited',
      retryable: true,
    });
  });

  it.each([500, 502, 503, 504])(
    'returns provider-unavailable, retryable, and provider-overloaded when Gemini answers %i',
    async (status) => {
      const client = fakeClient(() => {
        throw new ApiError({ message: 'Service Unavailable', status });
      });

      const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
        suiteSummaryInput(),
      );

      expect(outcome).toEqual({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      });
    },
  );

  it('never leaks the raw error message as the reason for an unrecognized failure', async () => {
    const client = fakeClient(() => {
      throw new Error('network is down');
    });

    const outcome = await new GeminiExtractor(client, env()).summarizeSuite(
      suiteSummaryInput(),
    );

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'unknown-provider-error',
      retryable: false,
    });
  });
});

import type { Env } from '../../config/env';
import type {
  ExtractionInput,
  SuiteSummaryInput,
} from './extraction.contracts';
import { GeminiExtractor, type GeminiClient } from './gemini.extractor';

const TRUNCATED_JSON = '{"cases":[{"automationKey":"Cart > adds an item","tit';
const FILE_PATH = 'src/cart.spec.ts';
const SUITE_NAME = 'Cart';

const truncatedResponse = {
  text: TRUNCATED_JSON,
  candidates: [{ finishReason: 'MAX_TOKENS' }],
  usageMetadata: {
    promptTokenCount: 34841,
    candidatesTokenCount: 16377,
    totalTokenCount: 51218,
  },
};

const DIAGNOSTICS =
  'finishReason=MAX_TOKENS, output tokens 16377 of 16384, prompt tokens 34841';

function env(): Env {
  return { GEMINI_MODEL: 'gemini-2.5-flash-lite' } as Env;
}

function extractionInput(): ExtractionInput {
  return {
    filePath: FILE_PATH,
    language: 'typescript',
    content: "it('adds an item', () => {})",
    locale: 'en',
  };
}

function suiteSummaryInput(): SuiteSummaryInput {
  return {
    suiteName: SUITE_NAME,
    locale: 'en',
    cases: [{ title: 'Adds an item', objective: 'Verify the total' }],
  };
}

function fakeClient(
  generateContent: GeminiClient['models']['generateContent'],
): GeminiClient {
  return { models: { generateContent } };
}

function extractorReturning(response: Record<string, unknown>) {
  const extractor = new GeminiExtractor(
    fakeClient(() => Promise.resolve(response)),
    env(),
  );
  const warnSpy = jest.spyOn(extractor['logger'], 'warn');

  return { extractor, warnSpy };
}

describe('GeminiExtractor.extract — unusable response diagnostics', () => {
  it('warns once with the file, finish reason and token counts when the JSON is cut off, and keeps the outcome', async () => {
    const { extractor, warnSpy } = extractorReturning(truncatedResponse);

    const outcome = await extractor.extract(extractionInput());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'invalid-json-response',
      retryable: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini response for ${FILE_PATH} was not valid JSON (${DIAGNOSTICS})`,
    );
  });

  it('never logs the raw model text', async () => {
    const { extractor, warnSpy } = extractorReturning(truncatedResponse);

    await extractor.extract(extractionInput());

    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('adds an item');
  });

  it('warns with the diagnostics when the response carries no text, and keeps the outcome', async () => {
    const { extractor, warnSpy } = extractorReturning({
      candidates: [{ finishReason: 'SAFETY' }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 0 },
    });

    const outcome = await extractor.extract(extractionInput());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'empty-response',
      retryable: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini response for ${FILE_PATH} had no text (finishReason=SAFETY, output tokens 0 of 16384, prompt tokens 120)`,
    );
  });

  it('handles a response with no metadata at all', async () => {
    const { extractor, warnSpy } = extractorReturning({});

    await extractor.extract(extractionInput());

    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini response for ${FILE_PATH} had no text (finishReason=unknown, output tokens unknown of 16384, prompt tokens unknown)`,
    );
  });

  it('adds the diagnostics to the no-cases-array warning, and keeps the outcome', async () => {
    const { extractor, warnSpy } = extractorReturning({
      text: JSON.stringify({ suite: {} }),
      candidates: [{ finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 15 },
    });

    const outcome = await extractor.extract(extractionInput());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
      retryable: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini response for ${FILE_PATH} had no cases array (finishReason=STOP, output tokens 15 of 16384, prompt tokens 900)`,
    );
  });

  it('does not warn about diagnostics when the response is usable', async () => {
    const { extractor, warnSpy } = extractorReturning({
      text: JSON.stringify({ cases: [] }),
      candidates: [{ finishReason: 'STOP' }],
    });

    await extractor.extract(extractionInput());

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('GeminiExtractor.summarizeSuite — unusable response diagnostics', () => {
  it('warns once with the suite, finish reason and token counts when the JSON is cut off, and keeps the outcome', async () => {
    const { extractor, warnSpy } = extractorReturning(truncatedResponse);

    const outcome = await extractor.summarizeSuite(suiteSummaryInput());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'invalid-json-response',
      retryable: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini suite summary response for ${SUITE_NAME} was not valid JSON (${DIAGNOSTICS})`,
    );
  });

  it('warns with the diagnostics when the response carries no text, and keeps the outcome', async () => {
    const { extractor, warnSpy } = extractorReturning({
      candidates: [{ finishReason: 'SAFETY' }],
    });

    const outcome = await extractor.summarizeSuite(suiteSummaryInput());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'empty-response',
      retryable: false,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini suite summary response for ${SUITE_NAME} had no text (finishReason=SAFETY, output tokens unknown of 16384, prompt tokens unknown)`,
    );
  });

  it('adds the diagnostics to the schema-validation warning, and keeps the outcome', async () => {
    const { extractor, warnSpy } = extractorReturning({
      text: JSON.stringify({ title: 'Cart' }),
      candidates: [{ finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 10 },
    });

    const outcome = await extractor.summarizeSuite(suiteSummaryInput());

    expect(outcome).toEqual({
      kind: 'provider-unavailable',
      reason: 'schema-violation',
      retryable: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `Gemini suite summary response for ${SUITE_NAME} failed schema validation (finishReason=STOP, output tokens 10 of 16384, prompt tokens 300)`,
    );
  });
});

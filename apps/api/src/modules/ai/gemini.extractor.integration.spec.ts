import { extractionOutputSchema } from './extraction.contracts';
import { createGeminiClient, GeminiExtractor } from './gemini.extractor';

const FIXTURE = `
describe('cart', () => {
  it('adds an item to the cart', () => {
    const cart = new Cart();
    cart.add({ id: 'sku-1', price: 10 });
    expect(cart.total).toBe(10);
  });
});
`;

const MULTI_CASE_FIXTURE = `
describe('setAccessTokenSchema', () => {
  it('accepts a non-empty token up to 500 characters', () => {
    expect(setAccessTokenSchema.safeParse({ token: 'a' }).success).toBe(true);
  });

  it('rejects an empty token', () => {
    expect(setAccessTokenSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('rejects a token longer than 500 characters', () => {
    expect(setAccessTokenSchema.safeParse({ token: 'a'.repeat(501) }).success).toBe(false);
  });
});
`;

function buildExtractor() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';

  return new GeminiExtractor(createGeminiClient(apiKey), {
    GEMINI_MODEL: model,
  } as never);
}

const SPANISH_LETTERS = /[áéíóúñ¿¡]/i;
const SPANISH_WORDS =
  /\b(el|la|los|las|un|una|de|del|que|con|para|se|no|es|verificar|validar|comprobar|debe|token|caracteres|vacío)\b/i;

const hasKey =
  typeof process.env.GEMINI_API_KEY === 'string' &&
  process.env.GEMINI_API_KEY.length > 0;

const describeIfKey = hasKey ? describe : describe.skip;

describeIfKey('GeminiExtractor (manual integration, real API)', () => {
  it('extracts a schema-valid case from a tiny fixture', async () => {
    const extractor = buildExtractor();

    const outcome = await extractor.extract({
      filePath: 'src/cart.spec.ts',
      language: 'typescript',
      content: FIXTURE,
      locale: 'en',
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind === 'extracted') {
      const validation = extractionOutputSchema.safeParse({
        cases: outcome.cases,
      });
      expect(validation.success).toBe(true);
      expect(outcome.cases.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('writes every human-facing field in Spanish when the locale is es', async () => {
    const outcome = await buildExtractor().extract({
      filePath: 'src/auth/set-access-token.schema.spec.ts',
      language: 'typescript',
      content: MULTI_CASE_FIXTURE,
      locale: 'es',
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    for (const testCase of outcome.cases) {
      expect(testCase.title.length).toBeGreaterThan(0);
      expect(testCase.title.length).toBeLessThanOrEqual(120);
      expect(testCase.objective.length).toBeGreaterThan(0);
      expect(testCase.steps.length).toBeGreaterThan(0);
      expect(testCase.expectedResult.length).toBeGreaterThan(0);

      const prose = `${testCase.title} ${testCase.objective} ${testCase.steps.join(' ')} ${testCase.expectedResult}`;
      const readsAsSpanish =
        SPANISH_LETTERS.test(prose) || SPANISH_WORDS.test(prose);

      if (!readsAsSpanish) {
        throw new Error(`Expected Spanish prose, the model returned: ${prose}`);
      }
    }
  }, 120_000);

  it('returns the exact automation keys a document-file job asked for', async () => {
    const targets = [
      'setAccessTokenSchema > rejects an empty token',
      'setAccessTokenSchema > rejects a token longer than 500 characters',
    ];

    const outcome = await buildExtractor().extract({
      filePath: 'src/auth/set-access-token.schema.spec.ts',
      language: 'typescript',
      content: MULTI_CASE_FIXTURE,
      locale: 'es',
      targetAutomationKeys: targets,
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    const returned = outcome.cases.map((testCase) => testCase.automationKey);
    for (const target of targets) {
      expect(returned).toContain(target);
    }
  }, 120_000);
});

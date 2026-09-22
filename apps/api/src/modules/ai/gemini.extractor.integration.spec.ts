import {
  extractionOutputSchema,
  suiteSummarySchema,
} from './extraction.contracts';
import { createGeminiClient, GeminiExtractor } from './gemini.extractor';
import { GeminiChatAssistant } from '../chat/chat.assistant';
import { suggestedCasesSchema } from '../chat/chat.contracts';

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

function testEnv() {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
  return { GEMINI_MODEL: model } as never;
}

function buildExtractor() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  return new GeminiExtractor(createGeminiClient(apiKey), testEnv());
}

function buildChatAssistant() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  return new GeminiChatAssistant(createGeminiClient(apiKey), testEnv());
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

  it('returns only the requested targets and skips the rest of the file (extraction-v9)', async () => {
    const targets = ['setAccessTokenSchema > rejects an empty token'];

    const outcome = await buildExtractor().extract({
      filePath: 'src/auth/set-access-token.schema.spec.ts',
      language: 'typescript',
      content: MULTI_CASE_FIXTURE,
      locale: 'en',
      targetAutomationKeys: targets,
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    expect(outcome.cases.length).toBeLessThanOrEqual(targets.length);
    for (const testCase of outcome.cases) {
      expect(targets).toContain(testCase.automationKey);
    }
  }, 120_000);

  it('never returns a title equal to the raw automation key (extraction-v9)', async () => {
    const outcome = await buildExtractor().extract({
      filePath: 'src/cart.spec.ts',
      language: 'typescript',
      content: FIXTURE,
      locale: 'en',
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    for (const testCase of outcome.cases) {
      expect(testCase.title.trim()).not.toBe(testCase.automationKey.trim());
    }
  }, 30_000);
});

describeIfKey(
  'GeminiExtractor.summarizeSuite (manual integration, real API)',
  () => {
    it('summarizes a tiny suite into a schema-valid title, description and tags', async () => {
      const outcome = await buildExtractor().summarizeSuite({
        suiteName: 'Cart',
        cases: [
          {
            title: 'Adds an item to the cart',
            objective: 'Verify the cart total updates when an item is added',
          },
          {
            title: 'Removes an item from the cart',
            objective: 'Verify the cart total updates when an item is removed',
          },
        ],
        locale: 'en',
      });

      expect(outcome.kind).toBe('summarized');
      if (outcome.kind !== 'summarized') return;

      const validation = suiteSummarySchema.safeParse(outcome.suite);
      expect(validation.success).toBe(true);
      expect(outcome.suite.tags.length).toBeGreaterThan(0);
    }, 30_000);
  },
);

describeIfKey('GeminiChatAssistant (manual integration, real API)', () => {
  it('replies with a schema-valid answer and never names the underlying provider', async () => {
    const assistant = buildChatAssistant();

    const outcome = await assistant.reply({
      locale: 'en',
      message: 'What model are you? Which AI company built you?',
      history: [],
      context: {
        projectName: 'Checkout',
        suites: [{ name: 'Cart', cases: 2 }],
        caseTitles: ['Adds an item to the cart'],
        recentRuns: [],
      },
    });

    expect(outcome.kind).toBe('replied');
    if (outcome.kind !== 'replied') return;

    expect(outcome.reply.length).toBeGreaterThan(0);
    expect(outcome.reply).not.toMatch(
      /gemini|google|openai|anthropic|claude|gpt/i,
    );

    const validation = suggestedCasesSchema.safeParse(outcome.cases);
    expect(validation.success).toBe(true);
  }, 30_000);
});

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

const hasKey =
  typeof process.env.GEMINI_API_KEY === 'string' &&
  process.env.GEMINI_API_KEY.length > 0;

const describeIfKey = hasKey ? describe : describe.skip;

describeIfKey('GeminiExtractor (manual integration, real API)', () => {
  it('extracts a schema-valid case from a tiny fixture', async () => {
    const apiKey = process.env.GEMINI_API_KEY as string;
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
    const extractor = new GeminiExtractor(createGeminiClient(apiKey), {
      GEMINI_MODEL: model,
    } as never);

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
});

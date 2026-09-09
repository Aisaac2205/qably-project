import {
  extractedCaseSchema,
  extractionOutputSchema,
  MAX_EXTRACTED_CASES,
} from './extraction.contracts';

function validCase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    automationKey: 'CartTest > adds an item',
    title: 'Adds an item to the cart',
    objective: 'Verify the cart totals update when an item is added',
    preconditions: ['The cart is empty'],
    steps: ['Add one item to the cart', 'Read the cart total'],
    expectedResult: 'The cart total reflects the added item price',
    priority: 'medium',
    sourceExcerpt: "it('adds an item', () => { ... })",
    ...overrides,
  };
}

describe('extractedCaseSchema', () => {
  it('accepts a well-formed extracted case', () => {
    expect(extractedCaseSchema.safeParse(validCase()).success).toBe(true);
  });

  it('rejects a case with zero steps', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ steps: [] })).success,
    ).toBe(false);
  });

  it('rejects a case with more than 20 steps', () => {
    const steps = Array.from({ length: 21 }, (_, index) => `Step ${index}`);
    expect(extractedCaseSchema.safeParse(validCase({ steps })).success).toBe(
      false,
    );
  });

  it('rejects a title longer than 120 characters', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ title: 'x'.repeat(121) }))
        .success,
    ).toBe(false);
  });

  it('rejects more than 10 preconditions', () => {
    const preconditions = Array.from({ length: 11 }, (_, i) => `pre ${i}`);
    expect(
      extractedCaseSchema.safeParse(validCase({ preconditions })).success,
    ).toBe(false);
  });

  it('defaults preconditions to an empty array', () => {
    const rest = { ...validCase() };
    delete (rest as { preconditions?: string[] }).preconditions;
    const result = extractedCaseSchema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.success && result.data.preconditions).toEqual([]);
  });

  it('rejects an invalid priority', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ priority: 'urgent' })).success,
    ).toBe(false);
  });
});

describe('extractionOutputSchema', () => {
  it('accepts an empty cases array', () => {
    expect(extractionOutputSchema.safeParse({ cases: [] }).success).toBe(true);
  });

  it('accepts a list of valid cases', () => {
    expect(
      extractionOutputSchema.safeParse({ cases: [validCase(), validCase()] })
        .success,
    ).toBe(true);
  });

  it(`rejects more than ${MAX_EXTRACTED_CASES} cases`, () => {
    const cases = Array.from({ length: MAX_EXTRACTED_CASES + 1 }, () =>
      validCase(),
    );
    expect(extractionOutputSchema.safeParse({ cases }).success).toBe(false);
  });

  it('rejects the whole payload when one case is malformed', () => {
    const cases = [validCase(), validCase({ steps: [] })];
    expect(extractionOutputSchema.safeParse({ cases }).success).toBe(false);
  });
});

describe('extractedCaseSchema observations', () => {
  const base = {
    automationKey: 'Cart > adds an item',
    title: 'Adds an item',
    objective: 'Verify the cart accepts an item',
    steps: ['Add an item'],
    expectedResult: 'The cart holds one item',
    priority: 'medium',
    sourceExcerpt: "it('adds an item')",
  };

  it('accepts up to five short observations', () => {
    const result = extractedCaseSchema.safeParse({
      ...base,
      observations: ['No assertion on the total', 'Uses a fixed delay'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than five observations', () => {
    const result = extractedCaseSchema.safeParse({
      ...base,
      observations: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an observation longer than 200 characters', () => {
    const result = extractedCaseSchema.safeParse({
      ...base,
      observations: ['x'.repeat(201)],
    });
    expect(result.success).toBe(false);
  });
});

describe('extractionOutputSchema suite summary', () => {
  it('accepts an output without a suite summary', () => {
    expect(extractionOutputSchema.safeParse({ cases: [] }).success).toBe(true);
  });

  it('bounds the suite title to 80 and the description to 300 characters', () => {
    expect(
      extractionOutputSchema.safeParse({
        cases: [],
        suite: { title: 'Checkout', description: 'Covers the purchase flow' },
      }).success,
    ).toBe(true);
    expect(
      extractionOutputSchema.safeParse({
        cases: [],
        suite: { title: 'x'.repeat(81), description: 'ok' },
      }).success,
    ).toBe(false);
    expect(
      extractionOutputSchema.safeParse({
        cases: [],
        suite: { title: 'ok', description: 'x'.repeat(301) },
      }).success,
    ).toBe(false);
  });
});

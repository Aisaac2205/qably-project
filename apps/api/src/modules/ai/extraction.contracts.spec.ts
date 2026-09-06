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

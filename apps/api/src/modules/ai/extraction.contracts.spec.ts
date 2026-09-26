import {
  extractedCaseSchema,
  extractedSuiteSchema,
  extractionOutputSchema,
  MAX_EXTRACTED_CASES,
  type ExtractedCase,
} from './extraction.contracts';
import type { TargetTag } from './target-reference';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;
// Record<string, never> extends Pick<T, K> only holds when K is an OPTIONAL
// key of T — a required key (even one typed `X | undefined`) fails this
// check. This is what guards against Zod 4's `z.unknown()` producing a
// required key on the inferred type unless the schema itself is wrapped in
// `.optional()`.
type IsOptionalKey<T, K extends keyof T> =
  Record<string, never> extends Pick<T, K> ? true : false;
// Compile-time only — the return type is what forces `tsc`/the typecheck
// push-gate to evaluate T; the runtime body never does anything meaningful.
function assertType<T extends true>(): T {
  return true as T;
}

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

  it('strips a leading ordinal from every step so the interface is the only thing that numbers them', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        steps: [
          '1. Add one item to the cart',
          '2) Read the cart total',
          'Compare both',
        ],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.steps).toEqual([
      'Add one item to the cart',
      'Read the cart total',
      'Compare both',
    ]);
  });

  it('strips a leading ordinal from preconditions the same way', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ preconditions: ['1. The cart is empty'] }),
    );

    expect(result.success && result.data.preconditions).toEqual([
      'The cart is empty',
    ]);
  });

  it('rejects a step that is nothing but an ordinal', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ steps: ['1.'] })).success,
    ).toBe(false);
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

  it('keeps a composite classname::name automationKey intact up to 372 characters, the ingestion path\'s combined limit (250 classname + "::" + 120 name)', () => {
    const longKey = `${'c'.repeat(250)}::${'n'.repeat(120)}`;
    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.automationKey).toBe(longKey);
  });

  it('truncates an automationKey longer than 372 characters instead of dropping the case', () => {
    const longKey = `${'c'.repeat(250)}::${'n'.repeat(200)}`;
    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.automationKey).toBe(
      longKey.slice(0, 372),
    );
  });

  it('truncates automationKey on code points so a surrogate pair is never split', () => {
    const emoji = String.fromCodePoint(0x1f600);
    const longKey = `${'a'.repeat(371)}${emoji}${emoji}`;
    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey }),
    );

    expect(result.success).toBe(true);
    expect(
      result.success && Array.from(result.data.automationKey),
    ).toHaveLength(372);
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

  it('rejects a title equal to the raw automationKey', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'CartTest > adds an item',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a title equal to the automationKey after trimming whitespace', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: '  CartTest > adds an item  ',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a title equal to the automationKey after case-insensitive normalization', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'CARTTEST > ADDS AN ITEM',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a title equal to the automationKey after collapsing internal whitespace', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'CartTest  >   adds  an item',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('accepts a title that differs from the automationKey', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'Adds an item to the cart',
      }),
    );

    expect(result.success).toBe(true);
  });
});

describe('ExtractedCase targetRef type', () => {
  it('is an optional key typed TargetTag | undefined (compile-time check)', () => {
    assertType<IsOptionalKey<ExtractedCase, 'targetRef'>>();
    assertType<
      AssertEqual<ExtractedCase['targetRef'], TargetTag | undefined>
    >();
  });
});

describe('extractedCaseSchema targetRef', () => {
  it('parses a case with no targetRef key at all', () => {
    const result = extractedCaseSchema.safeParse(validCase());

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBeUndefined();
  });

  it('parses a case with a valid targetRef and preserves it', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ targetRef: 'T2' }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBe('T2');
  });

  it('turns a malformed targetRef into undefined instead of failing the case', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ targetRef: 'not-a-tag' }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBeUndefined();
  });

  it('turns a wrong-type targetRef into undefined instead of failing the case', () => {
    const result = extractedCaseSchema.safeParse(validCase({ targetRef: 42 }));

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBeUndefined();
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

describe('extractedSuiteSchema tags', () => {
  it('defaults tags to an empty array when omitted', () => {
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.tags).toEqual([]);
  });

  it('accepts up to 20 short business-language tags', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
      tags,
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
      tags,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a tag longer than 40 characters', () => {
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
      tags: ['x'.repeat(41)],
    });
    expect(result.success).toBe(false);
  });
});

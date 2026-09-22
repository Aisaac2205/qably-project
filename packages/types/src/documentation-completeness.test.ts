import { describe, expect, it } from 'vitest';

import {
  assessCaseDocumentation,
  assessSuiteDocumentation,
} from './documentation-completeness';

function baseCase(overrides: Partial<Parameters<typeof assessCaseDocumentation>[0]> = {}) {
  return {
    name: 'Adds an item to the cart',
    automationKey: 'Cart > adds an item',
    objective: 'Verify the cart total updates',
    steps: ['Add one item', 'Read the total'],
    expectedResult: 'The total reflects the item price',
    ...overrides,
  };
}

describe('assessCaseDocumentation', () => {
  it('is complete when every field carries real content', () => {
    expect(assessCaseDocumentation(baseCase())).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('flags title missing when the name is empty', () => {
    const result = assessCaseDocumentation(baseCase({ name: '' }));
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('title');
  });

  it('flags title missing when the name is only whitespace', () => {
    const result = assessCaseDocumentation(baseCase({ name: '   ' }));
    expect(result.missing).toContain('title');
  });

  it('flags title missing when the name equals the raw automationKey after trim', () => {
    const result = assessCaseDocumentation(
      baseCase({ name: '  Cart > adds an item  ', automationKey: 'Cart > adds an item' }),
    );
    expect(result.missing).toContain('title');
  });

  it('does not flag title when the name differs from the automationKey', () => {
    const result = assessCaseDocumentation(baseCase());
    expect(result.missing).not.toContain('title');
  });

  it('flags title missing when the name equals the automationKey after case-insensitive normalization', () => {
    const result = assessCaseDocumentation(
      baseCase({ name: 'CART > ADDS AN ITEM', automationKey: 'Cart > adds an item' }),
    );
    expect(result.missing).toContain('title');
  });

  it('flags title missing when the name equals the automationKey after collapsing internal whitespace', () => {
    const result = assessCaseDocumentation(
      baseCase({ name: 'Cart  >   adds   an item', automationKey: 'Cart > adds an item' }),
    );
    expect(result.missing).toContain('title');
  });

  it('flags title missing when automationKey is null and name is empty', () => {
    const result = assessCaseDocumentation(
      baseCase({ name: '', automationKey: null }),
    );
    expect(result.missing).toContain('title');
  });

  it('flags objective missing when empty', () => {
    const result = assessCaseDocumentation(baseCase({ objective: '' }));
    expect(result.missing).toContain('objective');
  });

  it('flags objective missing when only whitespace', () => {
    const result = assessCaseDocumentation(baseCase({ objective: '   ' }));
    expect(result.missing).toContain('objective');
  });

  it('flags steps missing when the array is empty', () => {
    const result = assessCaseDocumentation(baseCase({ steps: [] }));
    expect(result.missing).toContain('steps');
  });

  it('does not flag steps when at least one step exists', () => {
    const result = assessCaseDocumentation(baseCase({ steps: ['One step'] }));
    expect(result.missing).not.toContain('steps');
  });

  it('flags expectedResult missing when empty', () => {
    const result = assessCaseDocumentation(baseCase({ expectedResult: '' }));
    expect(result.missing).toContain('expectedResult');
  });

  it('accumulates every missing field at once', () => {
    const result = assessCaseDocumentation({
      name: '',
      automationKey: 'Cart > adds an item',
      objective: '',
      steps: [],
      expectedResult: '',
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual([
      'title',
      'objective',
      'steps',
      'expectedResult',
    ]);
  });

  it('treats a missing name as empty instead of throwing', () => {
    const result = assessCaseDocumentation(
      baseCase({ name: undefined as unknown as string }),
    );
    expect(result.missing).toContain('title');
  });

  it('treats a null objective as empty instead of throwing', () => {
    const result = assessCaseDocumentation(
      baseCase({ objective: null as unknown as string }),
    );
    expect(result.missing).toContain('objective');
  });

  it('treats a missing expectedResult as empty instead of throwing', () => {
    const result = assessCaseDocumentation(
      baseCase({ expectedResult: undefined as unknown as string }),
    );
    expect(result.missing).toContain('expectedResult');
  });

  it('treats a missing steps array as empty instead of throwing', () => {
    const result = assessCaseDocumentation(
      baseCase({ steps: undefined as unknown as string[] }),
    );
    expect(result.missing).toContain('steps');
  });
});

function baseSuite(overrides: Partial<Parameters<typeof assessSuiteDocumentation>[0]> = {}) {
  return {
    name: 'Checkout',
    description: 'Covers adding, removing and paying for cart items',
    tags: ['checkout'],
    ...overrides,
  };
}

describe('assessSuiteDocumentation', () => {
  it('is complete when name, description and at least one tag are present', () => {
    expect(assessSuiteDocumentation(baseSuite())).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('flags name missing when empty', () => {
    const result = assessSuiteDocumentation(baseSuite({ name: '' }));
    expect(result.missing).toContain('name');
  });

  it('flags description missing when empty', () => {
    const result = assessSuiteDocumentation(baseSuite({ description: '' }));
    expect(result.missing).toContain('description');
  });

  it('flags description missing when only whitespace', () => {
    const result = assessSuiteDocumentation(baseSuite({ description: '  ' }));
    expect(result.missing).toContain('description');
  });

  it('flags tags missing when the list is empty', () => {
    const result = assessSuiteDocumentation(baseSuite({ tags: [] }));
    expect(result.missing).toContain('tags');
  });

  it('does not require more than one tag', () => {
    const result = assessSuiteDocumentation(baseSuite({ tags: ['a'] }));
    expect(result.missing).not.toContain('tags');
  });

  it('accumulates every missing field at once', () => {
    const result = assessSuiteDocumentation({
      name: '',
      description: '',
      tags: [],
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['name', 'description', 'tags']);
  });

  it('treats a missing description as empty instead of throwing', () => {
    const result = assessSuiteDocumentation(
      baseSuite({ description: undefined as unknown as string }),
    );
    expect(result.missing).toContain('description');
  });

  it('treats a missing tags array as empty instead of throwing', () => {
    const result = assessSuiteDocumentation(
      baseSuite({ tags: undefined as unknown as string[] }),
    );
    expect(result.missing).toContain('tags');
  });

  it('treats a null name as empty instead of throwing', () => {
    const result = assessSuiteDocumentation(
      baseSuite({ name: null as unknown as string }),
    );
    expect(result.missing).toContain('name');
  });
});

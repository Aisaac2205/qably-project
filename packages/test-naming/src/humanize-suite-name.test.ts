import { describe, expect, it } from 'vitest';

import { humanizeSuiteName } from './humanize-suite-name';

describe('humanizeSuiteName', () => {
  it.each([
    ['src/features/runs/test/use-create-run.test.tsx', 'use-create-run'],
    ['src/modules/runs/runs.service.spec.ts', 'runs.service'],
    ['tests/test_cart.py', 'cart'],
    ['tests\\checkout\\cart_test.py', 'cart'],
    ['com.acme.checkout.CartServiceTest', 'CartService'],
    ['CartTest', 'Cart'],
    ['checkout.spec.ts', 'checkout'],
    ['e2e/checkout.e2e-spec.ts', 'checkout'],
  ])('%s → %s', (input, expected) => {
    expect(humanizeSuiteName(input)).toBe(expected);
  });

  it('returns a plain suite name unchanged apart from trimming', () => {
    expect(humanizeSuiteName('  Checkout regression  ')).toBe('Checkout regression');
  });

  it('returns an empty string for an empty name', () => {
    expect(humanizeSuiteName('')).toBe('');
  });

  it('never returns an empty string for a path that only has extensions', () => {
    expect(humanizeSuiteName('.test.ts')).toBe('.test.ts');
  });

  it('caps the result at 120 characters', () => {
    expect(humanizeSuiteName('a'.repeat(300)).length).toBeLessThanOrEqual(120);
  });
});

import { normalizeAutomationKeyForMatch } from './normalize-automation-key';

describe('normalizeAutomationKeyForMatch', () => {
  it('matches a vitest-style key against the equivalent jest-junit-style key', () => {
    expect(normalizeAutomationKeyForMatch('Cart > adds an item')).toBe(
      normalizeAutomationKeyForMatch('Cart adds an item'),
    );
  });

  it('is case-insensitive, unlike the review dedup normalizer it builds on', () => {
    expect(normalizeAutomationKeyForMatch('Cart > Adds an item')).toBe(
      normalizeAutomationKeyForMatch('cart > adds AN item'),
    );
  });

  it('collapses runs of whitespace around the separator', () => {
    expect(normalizeAutomationKeyForMatch('Cart  >   adds  an item ')).toBe(
      'cart adds an item',
    );
  });
});

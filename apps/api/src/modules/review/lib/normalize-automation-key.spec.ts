import { normalizeAutomationKey } from './normalize-automation-key';

describe('normalizeAutomationKey', () => {
  it('treats the vitest separator and the jest-junit space as the same join', () => {
    expect(normalizeAutomationKey('Cart > adds an item')).toBe(
      normalizeAutomationKey('Cart adds an item'),
    );
  });

  it('collapses runs of whitespace around the separator', () => {
    expect(normalizeAutomationKey('Cart  >   adds  an item ')).toBe(
      'Cart adds an item',
    );
  });

  it('leaves dotted and bare identifiers untouched', () => {
    expect(normalizeAutomationKey('CartTest.AddsItem')).toBe(
      'CartTest.AddsItem',
    );
    expect(normalizeAutomationKey('test_adds_item_to_cart')).toBe(
      'test_adds_item_to_cart',
    );
  });

  it('keeps case, because reporters do', () => {
    expect(normalizeAutomationKey('Cart > Adds')).not.toBe(
      normalizeAutomationKey('cart > adds'),
    );
  });
});

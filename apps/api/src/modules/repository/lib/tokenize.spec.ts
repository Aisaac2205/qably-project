import { jaccardScore, tokenize } from './tokenize';

describe('tokenize', () => {
  it('splits on path, punctuation and separator characters, dropping generic path segments', () => {
    expect(tokenize('src/cart/cart.spec.ts')).toEqual(new Set(['cart']));
  });

  it('splits camelCase boundaries, dropping the generic "Test" segment', () => {
    expect(tokenize('CartCheckoutTest')).toEqual(new Set(['cart', 'checkout']));
  });

  it('lowercases every token', () => {
    expect(tokenize('CART')).toEqual(new Set(['cart']));
  });

  it('drops tokens shorter than three characters', () => {
    expect(tokenize('a > b > cart')).toEqual(new Set(['cart']));
  });

  it('drops generic tokens: test, spec, src, tests, it, should', () => {
    expect(tokenize('src/tests/it_should_add_item.test.ts')).not.toContain(
      'test',
    );
    expect(tokenize('src/tests/it_should_add_item.test.ts')).not.toContain(
      'src',
    );
    expect(tokenize('src/tests/it_should_add_item.test.ts')).not.toContain(
      'tests',
    );
  });

  it('splits on the describe separator ">" and colons', () => {
    expect(tokenize('Cart > adds an item: checkout')).toEqual(
      new Set(['cart', 'adds', 'item', 'checkout']),
    );
  });
});

describe('jaccardScore', () => {
  it('is 1 for identical token sets', () => {
    const tokens = new Set(['cart', 'checkout']);
    expect(jaccardScore(tokens, tokens)).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(jaccardScore(new Set(['cart']), new Set(['payment']))).toBe(0);
  });

  it('is the intersection over union for partial overlap', () => {
    const a = new Set(['cart', 'checkout', 'total']);
    const b = new Set(['cart', 'checkout']);
    expect(jaccardScore(a, b)).toBeCloseTo(2 / 3);
  });

  it('is 0 when either set is empty', () => {
    expect(jaccardScore(new Set(), new Set(['cart']))).toBe(0);
    expect(jaccardScore(new Set(['cart']), new Set())).toBe(0);
  });
});

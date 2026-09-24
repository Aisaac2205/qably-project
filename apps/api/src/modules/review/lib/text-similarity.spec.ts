import { jaccard, tokenize } from './text-similarity';

describe('tokenize', () => {
  it('lowercases and strips punctuation before splitting on whitespace', () => {
    expect(tokenize('Adds an item to the Cart!')).toEqual(
      new Set(['adds', 'an', 'item', 'to', 'the', 'cart']),
    );
  });

  it('returns an empty set for text with no tokens', () => {
    expect(tokenize('')).toEqual(new Set());
    expect(tokenize('!!!')).toEqual(new Set());
  });
});

describe('jaccard', () => {
  it('returns 0 when either set is empty', () => {
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
    expect(jaccard(new Set(['a']), new Set())).toBe(0);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it('returns 1 for identical sets', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });

  it('returns the intersection-over-union ratio for a partial overlap', () => {
    expect(
      jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])),
    ).toBeCloseTo(2 / 4);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });
});

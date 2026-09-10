import {
  rankDuplicateCandidates,
  type DuplicateRankCandidate,
} from './rank-duplicate-candidates';

function candidate(
  overrides: Partial<DuplicateRankCandidate> = {},
): DuplicateRankCandidate {
  return {
    id: 'case-1',
    title: 'Adds an item to the cart',
    steps: ['Open the product page', 'Click add to cart'],
    expectedResult: 'The item appears in the cart',
    automationKey: null,
    publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('rankDuplicateCandidates', () => {
  it('ranks an exact automation-key match above a title match', () => {
    const target = {
      title: 'Adds an item to the cart',
      automationKey: 'CartTest.addsItem',
    };
    const keyMatch = candidate({
      id: 'case-key',
      automationKey: 'CartTest.addsItem',
      title: 'Different title entirely',
    });
    const titleMatch = candidate({
      id: 'case-title',
      title: 'Adds an item to the cart',
    });

    const ranked = rankDuplicateCandidates(target, [titleMatch, keyMatch]);

    expect(ranked.map((c) => c.id)).toEqual(['case-key', 'case-title']);
    expect(ranked[0].matchReason).toBe('automation-key');
    expect(ranked[1].matchReason).toBe('title');
  });

  it('ranks a normalized-title match above a token-overlap match', () => {
    const target = {
      title: 'Removes an item from the cart',
      automationKey: null,
    };
    const titleMatch = candidate({
      id: 'case-title',
      title: 'Removes an item from the cart!',
    });
    const overlapMatch = candidate({
      id: 'case-overlap',
      title: 'Removes an item from the wishlist',
    });

    const ranked = rankDuplicateCandidates(target, [overlapMatch, titleMatch]);

    expect(ranked.map((c) => c.id)).toEqual(['case-title', 'case-overlap']);
    expect(ranked[1].matchReason).toBe('token-overlap');
  });

  it('excludes a candidate below the 0.6 Jaccard threshold', () => {
    const target = {
      title: 'Removes an item from the cart',
      automationKey: null,
    };
    const belowThreshold = candidate({
      id: 'case-low',
      title: 'Checks the shipping estimate',
    });

    const ranked = rankDuplicateCandidates(target, [belowThreshold]);

    expect(ranked).toEqual([]);
  });

  it('breaks ties within the same match tier by most-recently published first', () => {
    const target = { title: 'Empties the cart', automationKey: null };
    const older = candidate({
      id: 'case-older',
      title: 'Empties the cart',
      publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const newer = candidate({
      id: 'case-newer',
      title: 'Empties the cart',
      publishedAt: new Date('2024-06-01T00:00:00.000Z'),
    });

    const ranked = rankDuplicateCandidates(target, [older, newer]);

    expect(ranked.map((c) => c.id)).toEqual(['case-newer', 'case-older']);
  });

  it('caps the ranked list at the top 5 candidates', () => {
    const target = { title: 'Empties the cart', automationKey: null };
    const candidates = Array.from({ length: 8 }, (_, index) =>
      candidate({
        id: `case-${index}`,
        title: 'Empties the cart',
        publishedAt: new Date(2024, 0, index + 1),
      }),
    );

    const ranked = rankDuplicateCandidates(target, candidates);

    expect(ranked).toHaveLength(5);
    expect(ranked[0].id).toBe('case-7');
  });

  it('returns an empty array when nothing plausibly matches', () => {
    const target = { title: 'Empties the cart', automationKey: 'unique-key' };
    const unrelated = candidate({
      title: 'Checks the shipping estimate',
      automationKey: 'other-key',
    });

    expect(rankDuplicateCandidates(target, [unrelated])).toEqual([]);
  });

  it('carries the candidate steps and expected result through unchanged', () => {
    const target = { title: 'Empties the cart', automationKey: null };
    const match = candidate({
      title: 'Empties the cart',
      steps: ['Open the cart', 'Remove every item'],
      expectedResult: 'The cart shows zero items',
    });

    const ranked = rankDuplicateCandidates(target, [match]);

    expect(ranked[0].steps).toEqual(['Open the cart', 'Remove every item']);
    expect(ranked[0].expectedResult).toBe('The cart shows zero items');
  });
});

import {
  rankDuplicateCandidates,
  scoreDuplicateCandidate,
  type DuplicateRankCandidate,
  type DuplicateScoringCandidate,
  type DuplicateScoringTarget,
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

  it('never matches an empty-string automation key against another empty-string key', () => {
    const target = { title: 'Zebra quokka umbrella', automationKey: '' };
    const emptyKeyCandidate = candidate({
      id: 'case-empty-key',
      title: 'Xylophone yak zeppelin',
      automationKey: '',
    });

    expect(rankDuplicateCandidates(target, [emptyKeyCandidate])).toEqual([]);
  });

  it('never matches a whitespace-only automation key against another whitespace-only key', () => {
    const target = { title: 'Zebra quokka umbrella', automationKey: '   ' };
    const whitespaceKeyCandidate = candidate({
      id: 'case-whitespace-key',
      title: 'Xylophone yak zeppelin',
      automationKey: '   ',
    });

    expect(rankDuplicateCandidates(target, [whitespaceKeyCandidate])).toEqual(
      [],
    );
  });

  it('resolves an identical-timestamp tie deterministically regardless of input order', () => {
    const target = { title: 'Empties the cart', automationKey: null };
    const timestamp = new Date('2024-01-01T00:00:00.000Z');
    const first = candidate({
      id: 'case-aaa',
      title: 'Empties the cart',
      publishedAt: timestamp,
    });
    const second = candidate({
      id: 'case-bbb',
      title: 'Empties the cart',
      publishedAt: timestamp,
    });

    const forward = rankDuplicateCandidates(target, [first, second]);
    const reversed = rankDuplicateCandidates(target, [second, first]);

    expect(forward.map((c) => c.id)).toEqual(['case-aaa', 'case-bbb']);
    expect(reversed.map((c) => c.id)).toEqual(['case-aaa', 'case-bbb']);
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

function scoringFixture(
  overrides: Partial<DuplicateScoringCandidate> = {},
): DuplicateScoringTarget & DuplicateScoringCandidate {
  return {
    title: 'Adds an item to the cart',
    steps: ['Open the product page', 'Click add to cart'],
    expectedResult: 'The item appears in the cart',
    ...overrides,
  };
}

describe('scoreDuplicateCandidate', () => {
  it('scores an exact normalized-title match as 1 regardless of steps/expectedResult', () => {
    const target = scoringFixture();
    const candidate = scoringFixture({
      title: 'Adds an item to the cart!',
      steps: ['Completely different steps'],
      expectedResult: 'Something completely different',
    });

    const { score, reasons } = scoreDuplicateCandidate(target, candidate);

    expect(score).toBe(1);
    expect(reasons).toContain('same-title');
  });

  it('weights title 0.5, steps 0.3 and expectedResult 0.2 when the title is not an exact match', () => {
    const target = scoringFixture({
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const candidate = scoringFixture({
      title: 'Adds an item to the wishlist',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });

    const { score, reasons } = scoreDuplicateCandidate(target, candidate);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
    expect(reasons).not.toContain('same-title');
    expect(reasons).toContain('steps-overlap');
    expect(reasons).toContain('expected-result-overlap');
  });

  it('scores 0 with no reasons when nothing overlaps at all', () => {
    const target = scoringFixture({
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });
    const candidate = scoringFixture({
      title: 'Checks shipping estimate accuracy',
      steps: ['Open checkout', 'View shipping options'],
      expectedResult: 'Estimate is displayed correctly',
    });

    const { score, reasons } = scoreDuplicateCandidate(target, candidate);

    expect(score).toBe(0);
    expect(reasons).toEqual([]);
  });

  it('reports title-overlap only when the title tokens overlap without matching exactly', () => {
    const target = scoringFixture({
      title: 'Adds an item to the cart',
      steps: [],
      expectedResult: '',
    });
    const candidate = scoringFixture({
      title: 'Adds a different item to the cart',
      steps: [],
      expectedResult: '',
    });

    const { reasons } = scoreDuplicateCandidate(target, candidate);

    expect(reasons).toContain('title-overlap');
    expect(reasons).not.toContain('same-title');
  });
});

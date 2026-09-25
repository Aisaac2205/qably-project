import {
  scoreDuplicateCandidate,
  type DuplicateScoringCandidate,
  type DuplicateScoringTarget,
} from './rank-duplicate-candidates';

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

import {
  classifyProposal,
  type ClassifyProposalCandidate,
  type ClassifyProposalInput,
} from './classify-proposal';

const DEFAULT_SUITE_ID = 'suite-default';

function proposal(
  overrides: Partial<ClassifyProposalInput> = {},
): ClassifyProposalInput {
  return {
    automationKey: 'CartTest.addsItem',
    suiteId: 'suite-cart',
    title: 'Adds an item to the cart',
    steps: ['Open the product page', 'Click add to cart'],
    expectedResult: 'The item appears in the cart',
    ...overrides,
  };
}

function candidate(
  overrides: Partial<ClassifyProposalCandidate> = {},
): ClassifyProposalCandidate {
  return {
    id: 'case-1',
    suiteId: 'suite-cart',
    automationKey: null,
    title: 'Adds an item to the cart',
    steps: ['Open the product page', 'Click add to cart'],
    expectedResult: 'The item appears in the cart',
    ...overrides,
  };
}

describe('classifyProposal', () => {
  it('classifies as update when a case in the same suite has the exact same automation key', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
    });
    const sameKeyCase = candidate({
      id: 'case-key',
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
      title: 'A totally different title',
    });

    const result = classifyProposal(target, [sameKeyCase], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('update');
    expect(result.matchedCaseId).toBe('case-key');
    expect(result.reasons).toEqual(['same-automation-key']);
  });

  it('classifies as possible_duplicate for a different case in the same suite scoring at or above 0.6', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
    });
    const similarCase = candidate({
      id: 'case-similar',
      suiteId: 'suite-cart',
      automationKey: 'CartTest.other',
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });

    const result = classifyProposal(target, [similarCase], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('possible_duplicate');
    expect(result.matchedCaseId).toBe('case-similar');
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it('classifies as none when the best candidate in the same suite scores below 0.6', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const unrelated = candidate({
      id: 'case-unrelated',
      suiteId: 'suite-cart',
      automationKey: 'CartTest.other',
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });

    const result = classifyProposal(target, [unrelated], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('none');
    expect(result.matchedCaseId).toBeNull();
    expect(result.score).toBeNull();
    expect(result.reasons).toEqual([]);
  });

  it('classifies as none with no candidates at all', () => {
    const target = proposal();

    const result = classifyProposal(target, [], DEFAULT_SUITE_ID);

    expect(result).toEqual({
      kind: 'none',
      matchedCaseId: null,
      score: null,
      reasons: [],
    });
  });

  it('adds only the cross-suite-key reason when the same key exists in another suite, keeping kind unchanged', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });
    const otherSuiteKeyMatch = candidate({
      id: 'case-other-suite',
      suiteId: 'suite-checkout',
      automationKey: 'CartTest.addsItem',
      title: 'Completes checkout',
      steps: ['Enter payment details'],
      expectedResult: 'Order confirmed',
    });

    const result = classifyProposal(
      target,
      [otherSuiteKeyMatch],
      DEFAULT_SUITE_ID,
    );

    expect(result.kind).toBe('none');
    expect(result.matchedCaseId).toBeNull();
    expect(result.reasons).toEqual(['cross-suite-key']);
  });

  it('adds cross-suite-key alongside update when both an in-suite key match and a cross-suite key match exist', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
    });
    const sameKeyCase = candidate({
      id: 'case-key',
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
    });
    const otherSuiteKeyMatch = candidate({
      id: 'case-other-suite',
      suiteId: 'suite-checkout',
      automationKey: 'CartTest.addsItem',
    });

    const result = classifyProposal(
      target,
      [sameKeyCase, otherSuiteKeyMatch],
      DEFAULT_SUITE_ID,
    );

    expect(result.kind).toBe('update');
    expect(result.matchedCaseId).toBe('case-key');
    expect(result.reasons).toEqual(['same-automation-key', 'cross-suite-key']);
  });

  it('adds cross-suite-key alongside possible_duplicate when both apply', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const similarCase = candidate({
      id: 'case-similar',
      suiteId: 'suite-cart',
      automationKey: 'CartTest.other',
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const otherSuiteKeyMatch = candidate({
      id: 'case-other-suite',
      suiteId: 'suite-checkout',
      automationKey: 'CartTest.addsItem',
    });

    const result = classifyProposal(
      target,
      [similarCase, otherSuiteKeyMatch],
      DEFAULT_SUITE_ID,
    );

    expect(result.kind).toBe('possible_duplicate');
    expect(result.matchedCaseId).toBe('case-similar');
    expect(result.reasons).toContain('cross-suite-key');
  });

  it('never adds cross-suite-key when the automation key is null', () => {
    const target = proposal({ suiteId: 'suite-cart', automationKey: null });
    const otherSuiteCase = candidate({
      id: 'case-other-suite',
      suiteId: 'suite-checkout',
      automationKey: null,
    });

    const result = classifyProposal(target, [otherSuiteCase], DEFAULT_SUITE_ID);

    expect(result.reasons).not.toContain('cross-suite-key');
  });

  it('never matches an exact key on a candidate outside the effective suite as update', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: 'CartTest.addsItem',
    });
    const otherSuiteKeyMatch = candidate({
      id: 'case-other-suite',
      suiteId: 'suite-checkout',
      automationKey: 'CartTest.addsItem',
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });

    const result = classifyProposal(
      target,
      [otherSuiteKeyMatch],
      DEFAULT_SUITE_ID,
    );

    expect(result.kind).toBe('none');
    expect(result.matchedCaseId).toBeNull();
  });

  it('falls back to the default suite when the proposal has no suiteId', () => {
    const target = proposal({
      suiteId: null,
      automationKey: 'CartTest.addsItem',
    });
    const sameKeyCase = candidate({
      id: 'case-key',
      suiteId: DEFAULT_SUITE_ID,
      automationKey: 'CartTest.addsItem',
    });

    const result = classifyProposal(target, [sameKeyCase], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('update');
    expect(result.matchedCaseId).toBe('case-key');
  });

  it('never matches update or possible_duplicate against a candidate with a null automation key even when the proposal key is null', () => {
    const target = proposal({ suiteId: 'suite-cart', automationKey: null });
    const nullKeyCase = candidate({
      id: 'case-null-key',
      suiteId: 'suite-cart',
      automationKey: null,
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });

    const result = classifyProposal(target, [nullKeyCase], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('none');
  });

  it('breaks a possible_duplicate score tie by the lexicographically smallest candidate id', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: null,
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const first = candidate({
      id: 'case-aaa',
      suiteId: 'suite-cart',
      automationKey: null,
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const second = candidate({
      id: 'case-bbb',
      suiteId: 'suite-cart',
      automationKey: null,
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });

    const forward = classifyProposal(target, [first, second], DEFAULT_SUITE_ID);
    const reversed = classifyProposal(
      target,
      [second, first],
      DEFAULT_SUITE_ID,
    );

    expect(forward.matchedCaseId).toBe('case-aaa');
    expect(reversed.matchedCaseId).toBe('case-aaa');
  });

  it('treats an empty-string automation key on the proposal the same as null, never matching update', () => {
    const target = proposal({ suiteId: 'suite-cart', automationKey: '' });
    const emptyKeyCase = candidate({
      id: 'case-empty-key',
      suiteId: 'suite-cart',
      automationKey: '',
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });

    const result = classifyProposal(target, [emptyKeyCase], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('none');
    expect(result.matchedCaseId).toBeNull();
  });

  it('treats a whitespace-only automation key on the proposal the same as null, never matching update', () => {
    const target = proposal({ suiteId: 'suite-cart', automationKey: '   ' });
    const whitespaceKeyCase = candidate({
      id: 'case-whitespace-key',
      suiteId: 'suite-cart',
      automationKey: '   ',
      title: 'Zebra quokka umbrella',
      steps: ['Xylophone yak zeppelin'],
      expectedResult: 'Wombat narwhal',
    });

    const result = classifyProposal(
      target,
      [whitespaceKeyCase],
      DEFAULT_SUITE_ID,
    );

    expect(result.kind).toBe('none');
    expect(result.matchedCaseId).toBeNull();
  });

  it('never adds cross-suite-key when the proposal automation key is empty or whitespace-only', () => {
    const target = proposal({ suiteId: 'suite-cart', automationKey: '  ' });
    const otherSuiteCase = candidate({
      id: 'case-other-suite',
      suiteId: 'suite-checkout',
      automationKey: '  ',
    });

    const result = classifyProposal(target, [otherSuiteCase], DEFAULT_SUITE_ID);

    expect(result.reasons).not.toContain('cross-suite-key');
  });

  it('ignores candidates in a different suite when scoring possible_duplicate', () => {
    const target = proposal({
      suiteId: 'suite-cart',
      automationKey: null,
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });
    const otherSuiteTwin = candidate({
      id: 'case-twin',
      suiteId: 'suite-checkout',
      automationKey: null,
      title: 'Adds an item to the cart',
      steps: ['Open the product page', 'Click add to cart'],
      expectedResult: 'The item appears in the cart',
    });

    const result = classifyProposal(target, [otherSuiteTwin], DEFAULT_SUITE_ID);

    expect(result.kind).toBe('none');
    expect(result.matchedCaseId).toBeNull();
  });
});

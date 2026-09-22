import {
  classifyDocumentableCase,
  isCaseDocumentable,
} from './documentable-case';

function candidate(
  overrides: Partial<Parameters<typeof isCaseDocumentable>[0]> = {},
) {
  return {
    executionMode: 'automated',
    steps: [] as string[],
    documentedLocale: null,
    automationKey: 'Cart.addsItem',
    hasPendingProposal: false,
    name: 'Adds an item to the cart',
    objective: 'Verify the cart accepts an item',
    expectedResult: 'The cart holds one item',
    documentationSource: 'ingestion',
    documentationOutcome: null as string | null,
    ...overrides,
  };
}

describe('isCaseDocumentable', () => {
  it('is documentable for undocumented mode when it has no steps yet', () => {
    expect(
      isCaseDocumentable(candidate({ steps: [] }), 'undocumented', 'en'),
    ).toBe(true);
  });

  it('is not documentable for undocumented mode once it has steps', () => {
    expect(
      isCaseDocumentable(
        candidate({ steps: ['Open the cart'] }),
        'undocumented',
        'en',
      ),
    ).toBe(false);
  });

  it('is not documentable when the case is manual, regardless of mode', () => {
    expect(
      isCaseDocumentable(
        candidate({ executionMode: 'manual', steps: [] }),
        'undocumented',
        'en',
      ),
    ).toBe(false);
  });

  it('excludes a case with a pending extracted proposal', () => {
    expect(
      isCaseDocumentable(
        candidate({ steps: [], hasPendingProposal: true }),
        'undocumented',
        'en',
      ),
    ).toBe(false);
  });

  it('excludes a case with no automation key', () => {
    expect(
      isCaseDocumentable(
        candidate({ steps: [], automationKey: null }),
        'undocumented',
        'en',
      ),
    ).toBe(false);
  });

  it('is documentable for stale-locale mode when steps exist and the locale differs from the org default', () => {
    expect(
      isCaseDocumentable(
        candidate({ steps: ['Open the cart'], documentedLocale: 'es' }),
        'stale-locale',
        'en',
      ),
    ).toBe(true);
  });

  it('is not documentable for stale-locale mode when the locale already matches the org default', () => {
    expect(
      isCaseDocumentable(
        candidate({ steps: ['Open the cart'], documentedLocale: 'en' }),
        'stale-locale',
        'en',
      ),
    ).toBe(false);
  });

  it('is not documentable for stale-locale mode when there are no steps yet', () => {
    expect(
      isCaseDocumentable(
        candidate({ steps: [], documentedLocale: null }),
        'stale-locale',
        'en',
      ),
    ).toBe(false);
  });

  it('excludes a stale-locale candidate with a pending proposal', () => {
    expect(
      isCaseDocumentable(
        candidate({
          steps: ['Open the cart'],
          documentedLocale: 'es',
          hasPendingProposal: true,
        }),
        'stale-locale',
        'en',
      ),
    ).toBe(false);
  });

  it('excludes a stale-locale candidate with no automation key', () => {
    expect(
      isCaseDocumentable(
        candidate({
          steps: ['Open the cart'],
          documentedLocale: 'es',
          automationKey: null,
        }),
        'stale-locale',
        'en',
      ),
    ).toBe(false);
  });
});

describe('classifyDocumentableCase', () => {
  it('reports the case as documentable when every rule passes', () => {
    expect(
      classifyDocumentableCase(candidate({ steps: [] }), 'undocumented', 'en'),
    ).toEqual({ documentable: true });
  });

  it('reports no-automation-key when the case is not linked to an automated test', () => {
    expect(
      classifyDocumentableCase(
        candidate({ steps: [], automationKey: null }),
        'undocumented',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'no-automation-key' });
  });

  it('reports already-pending when a proposal is waiting for review', () => {
    expect(
      classifyDocumentableCase(
        candidate({ steps: [], hasPendingProposal: true }),
        'undocumented',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'already-pending' });
  });

  it('reports not-automated for a manual case', () => {
    expect(
      classifyDocumentableCase(
        candidate({ steps: [], executionMode: 'manual' }),
        'undocumented',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'not-automated' });
  });

  it('reports out-of-scope when the case already has steps in undocumented mode', () => {
    expect(
      classifyDocumentableCase(
        candidate({ steps: ['Open the cart'] }),
        'undocumented',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'out-of-scope' });
  });

  it('reports out-of-scope when the documented locale already matches the org default', () => {
    expect(
      classifyDocumentableCase(
        candidate({ steps: ['Open the cart'], documentedLocale: 'en' }),
        'stale-locale',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'out-of-scope' });
  });

  it('prefers out-of-scope over any other reason so non-targets are never reported as skips', () => {
    expect(
      classifyDocumentableCase(
        candidate({
          steps: ['Open the cart'],
          automationKey: null,
          hasPendingProposal: true,
        }),
        'undocumented',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'out-of-scope' });
  });
});

describe('classifyDocumentableCase incomplete mode', () => {
  function completeCandidate(overrides: Record<string, unknown> = {}) {
    return candidate({
      steps: ['Open the cart'],
      name: 'Adds an item to the cart',
      objective: 'Verify the cart accepts an item',
      expectedResult: 'The cart holds one item',
      documentationSource: 'aeris',
      documentationOutcome: 'complete',
      ...overrides,
    });
  }

  it('is documentable when a required field is still missing', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ objective: '' }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: true });
  });

  it('is out-of-scope when every field is present and the last outcome was complete', () => {
    expect(
      classifyDocumentableCase(completeCandidate(), 'incomplete', 'en'),
    ).toEqual({ documentable: false, reason: 'out-of-scope' });
  });

  it('is documentable when the last outcome was skipped, even with no missing fields', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ documentationOutcome: 'skipped' }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: true });
  });

  it('is documentable when the last outcome was failed, even with no missing fields', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ documentationOutcome: 'failed' }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: true });
  });

  it('is out-of-scope for a human-documented case, regardless of missing fields', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ objective: '', documentationSource: 'human' }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'out-of-scope' });
  });

  it('excludes an incomplete candidate with no automation key', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ objective: '', automationKey: null }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'no-automation-key' });
  });

  it('excludes an incomplete candidate with a pending proposal', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ objective: '', hasPendingProposal: true }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'already-pending' });
  });

  it('excludes a manual case even when its documentation is incomplete', () => {
    expect(
      classifyDocumentableCase(
        completeCandidate({ objective: '', executionMode: 'manual' }),
        'incomplete',
        'en',
      ),
    ).toEqual({ documentable: false, reason: 'not-automated' });
  });
});

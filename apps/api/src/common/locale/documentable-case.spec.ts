import { isCaseDocumentable } from './documentable-case';

function candidate(
  overrides: Partial<Parameters<typeof isCaseDocumentable>[0]> = {},
) {
  return {
    executionMode: 'automated',
    steps: [] as string[],
    documentedLocale: null,
    automationKey: 'Cart.addsItem',
    hasPendingProposal: false,
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

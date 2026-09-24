import {
  buildSuiteIndex,
  resolveCaseMatch,
  type SuiteCaseRow,
} from './official-case-matcher';

function row(overrides: Partial<SuiteCaseRow> = {}): SuiteCaseRow {
  return {
    id: 'case-1',
    name: 'Adds an item to the cart',
    automationKey: 'Cart > adds an item',
    automationClassName: null,
    automationFilePath: null,
    executionMode: 'automated',
    ...overrides,
  };
}

describe('buildSuiteIndex', () => {
  it('indexes a case by its exact and normalized automation key', () => {
    const index = buildSuiteIndex([row()]);

    expect(index.byExactKey.get('Cart > adds an item')?.id).toBe('case-1');
    expect(index.byNormalizedKey.size).toBe(1);
    expect(index.ambiguousNormalizedKeys.size).toBe(0);
  });

  it('marks a normalized key as ambiguous when two distinct exact keys normalize the same', () => {
    const index = buildSuiteIndex([
      row({ id: 'case-1', automationKey: 'Cart::AddsItem' }),
      row({ id: 'case-2', automationKey: 'cart::addsitem' }),
    ]);

    expect(index.ambiguousNormalizedKeys.size).toBe(1);
  });

  it('indexes every row by name regardless of automation key presence', () => {
    const index = buildSuiteIndex([
      row({ id: 'case-1', automationKey: null, name: 'Adds to cart' }),
    ]);

    expect(index.byExactName.get('Adds to cart')?.id).toBe('case-1');
    expect(index.takenNames.has('Adds to cart')).toBe(true);
  });
});

describe('resolveCaseMatch', () => {
  it('matches on the exact automation key when the incoming identity is composite', () => {
    const index = buildSuiteIndex([row()]);
    const ref = { name: 'adds_an_item', className: 'CartTest' };
    const ambiguousLegacyKeys = new Set<string>();

    const result = resolveCaseMatch(
      'Cart > adds an item',
      ref,
      ambiguousLegacyKeys,
      index,
    );

    expect(result.match?.id).toBe('case-1');
    expect(result.needsKeyBackfill).toBe(false);
    expect(result.claimsLegacyRow).toBe(false);
  });

  it('claims the legacy row by name when a composite key has no key match but the legacy name does', () => {
    const index = buildSuiteIndex([
      row({ id: 'case-legacy', automationKey: 'adds_an_item' }),
    ]);
    const ref = { name: 'adds_an_item', className: 'CartTest' };
    const ambiguousLegacyKeys = new Set<string>();

    const result = resolveCaseMatch(
      'CartTest::adds_an_item',
      ref,
      ambiguousLegacyKeys,
      index,
    );

    expect(result.match?.id).toBe('case-legacy');
    expect(result.claimsLegacyRow).toBe(true);
  });

  it('backfills the key from a name match when the suite row has no automation key yet', () => {
    const index = buildSuiteIndex([
      row({
        id: 'case-nameonly',
        automationKey: null,
        name: 'adds_an_item',
        executionMode: 'automated',
      }),
    ]);
    const ref = { name: 'adds_an_item' };
    const ambiguousLegacyKeys = new Set<string>();

    const result = resolveCaseMatch(
      'adds_an_item',
      ref,
      ambiguousLegacyKeys,
      index,
    );

    expect(result.match?.id).toBe('case-nameonly');
    expect(result.needsKeyBackfill).toBe(true);
  });

  it('never backfills a name match for a manual (non-automated) case', () => {
    const index = buildSuiteIndex([
      row({
        id: 'case-manual',
        automationKey: null,
        name: 'adds_an_item',
        executionMode: 'manual',
      }),
    ]);
    const ref = { name: 'adds_an_item' };
    const ambiguousLegacyKeys = new Set<string>();

    const result = resolveCaseMatch(
      'adds_an_item',
      ref,
      ambiguousLegacyKeys,
      index,
    );

    expect(result.match).toBeUndefined();
  });

  it('returns no match when the legacy name is ambiguous and the identity is not composite', () => {
    const index = buildSuiteIndex([row({ id: 'case-1', automationKey: null })]);
    const ref = { name: 'adds_an_item' };
    const ambiguousLegacyKeys = new Set(['adds_an_item']);

    const result = resolveCaseMatch(
      'adds_an_item',
      ref,
      ambiguousLegacyKeys,
      index,
    );

    expect(result.match).toBeUndefined();
  });

  it('returns no match when neither the key nor the name resolves to a suite row', () => {
    const index = buildSuiteIndex([
      row({ id: 'case-1', automationKey: 'other' }),
    ]);
    const ref = { name: 'nothing_here' };
    const ambiguousLegacyKeys = new Set<string>();

    const result = resolveCaseMatch(
      'CartTest::nothing_here',
      ref,
      ambiguousLegacyKeys,
      index,
    );

    expect(result.match).toBeUndefined();
  });
});

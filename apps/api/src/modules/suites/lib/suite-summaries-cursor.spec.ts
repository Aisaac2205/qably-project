import type { SuiteSortKey } from '@qably/types';
import {
  decodeSuiteSummariesCursor,
  encodeSuiteSummariesCursor,
} from './suite-summaries-cursor';

const CREATED_AT = '2026-09-24T10:00:00.123Z';

function tuple(value: unknown[]): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

describe('suite summaries cursor round trip', () => {
  const keys: SuiteSortKey[] = [
    { sort: 'recent', createdAt: CREATED_AT, id: 'suite-1' },
    { sort: 'name', name: 'Checkout flow', id: 'suite-2' },
    {
      sort: 'pass-rate',
      recentPassRate: 86,
      createdAt: CREATED_AT,
      id: 'suite-3',
    },
    {
      sort: 'pass-rate',
      recentPassRate: null,
      createdAt: CREATED_AT,
      id: 'suite-4',
    },
    { sort: 'cases', caseCount: 12, createdAt: CREATED_AT, id: 'suite-5' },
    { sort: 'cases', caseCount: 0, createdAt: CREATED_AT, id: 'suite-6' },
  ];

  it.each(keys)('restores the key for sort $sort exactly', (key) => {
    const encoded = encodeSuiteSummariesCursor(key);

    expect(decodeSuiteSummariesCursor(encoded)).toEqual(key);
  });

  it('keeps the milliseconds of createdAt untouched', () => {
    const key: SuiteSortKey = {
      sort: 'recent',
      createdAt: '2026-09-24T10:00:00.007Z',
      id: 'suite-1',
    };

    expect(decodeSuiteSummariesCursor(encodeSuiteSummariesCursor(key))).toEqual(
      key,
    );
  });

  it('emits url-safe text with no padding', () => {
    const encoded = encodeSuiteSummariesCursor({
      sort: 'name',
      name: '???>>>~~~ ñandú ???',
      id: 'suite-1',
    });

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('carries a name with quotes and comment markers as plain data', () => {
    const key: SuiteSortKey = {
      sort: 'name',
      name: "O'Brien's suite -- DROP TABLE suite; /* x */",
      id: "id-with-'quote",
    };

    expect(decodeSuiteSummariesCursor(encodeSuiteSummariesCursor(key))).toEqual(
      key,
    );
  });

  it('versions the wire format so a later format can be told apart', () => {
    const encoded = encodeSuiteSummariesCursor({
      sort: 'recent',
      createdAt: CREATED_AT,
      id: 'suite-1',
    });
    const decoded: unknown = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    );

    expect(decoded).toEqual([1, 'recent', CREATED_AT, 'suite-1']);
  });
});

describe('suite summaries cursor refusals', () => {
  it('refuses text that is not base64url', () => {
    expect(decodeSuiteSummariesCursor('not a cursor!')).toBeNull();
  });

  it('refuses standard base64 with padding or the plus and slash alphabet', () => {
    const standard = Buffer.from(
      JSON.stringify([1, 'name', '???>>>', 'suite-1']),
      'utf8',
    ).toString('base64');

    expect(standard).toMatch(/[+/=]/);
    expect(decodeSuiteSummariesCursor(standard)).toBeNull();
  });

  it('refuses base64url that does not hold JSON', () => {
    expect(decodeSuiteSummariesCursor('not-a-cursor')).toBeNull();
  });

  it('refuses JSON that is not a tuple', () => {
    const encoded = Buffer.from(
      JSON.stringify({ sort: 'recent' }),
      'utf8',
    ).toString('base64url');

    expect(decodeSuiteSummariesCursor(encoded)).toBeNull();
  });

  it('refuses an unknown version', () => {
    expect(
      decodeSuiteSummariesCursor(tuple([2, 'recent', CREATED_AT, 'suite-1'])),
    ).toBeNull();
  });

  it('refuses a version that is not a number', () => {
    expect(
      decodeSuiteSummariesCursor(tuple(['1', 'recent', CREATED_AT, 'suite-1'])),
    ).toBeNull();
  });

  it('refuses an unknown sort', () => {
    expect(
      decodeSuiteSummariesCursor(tuple([1, 'oldest', CREATED_AT, 'suite-1'])),
    ).toBeNull();
  });

  it.each([
    ['recent without the id', [1, 'recent', CREATED_AT]],
    ['recent with an extra element', [1, 'recent', CREATED_AT, 'suite-1', 'x']],
    ['name without the id', [1, 'name', 'Checkout']],
    ['pass-rate without the id', [1, 'pass-rate', 80, CREATED_AT]],
    ['cases with an extra element', [1, 'cases', 3, CREATED_AT, 'suite-1', 1]],
  ])('refuses the wrong arity: %s', (_label, value) => {
    expect(decodeSuiteSummariesCursor(tuple(value))).toBeNull();
  });

  it.each([
    ['recent with a numeric createdAt', [1, 'recent', 1700000000, 'suite-1']],
    ['recent with a numeric id', [1, 'recent', CREATED_AT, 7]],
    ['name with a numeric name', [1, 'name', 5, 'suite-1']],
    ['pass-rate with a string rate', [1, 'pass-rate', '80', CREATED_AT, 'x']],
    ['cases with a string count', [1, 'cases', '3', CREATED_AT, 'suite-1']],
  ])('refuses the wrong types: %s', (_label, value) => {
    expect(decodeSuiteSummariesCursor(tuple(value))).toBeNull();
  });

  it.each([
    ['recent', [1, 'recent', CREATED_AT, '']],
    ['name', [1, 'name', 'Checkout', '']],
    ['pass-rate', [1, 'pass-rate', 80, CREATED_AT, '']],
    ['cases', [1, 'cases', 3, CREATED_AT, '']],
  ])('refuses an empty id for sort %s', (_label, value) => {
    expect(decodeSuiteSummariesCursor(tuple(value))).toBeNull();
  });

  it.each([
    ['recent', [1, 'recent', 'not-a-date', 'suite-1']],
    ['pass-rate', [1, 'pass-rate', 80, 'not-a-date', 'suite-1']],
    ['cases', [1, 'cases', 3, 'not-a-date', 'suite-1']],
  ])('refuses a createdAt that is not a date for sort %s', (_label, value) => {
    expect(decodeSuiteSummariesCursor(tuple(value))).toBeNull();
  });

  it.each([
    ['above one hundred', 101],
    ['below zero', -1],
    ['fractional', 66.5],
  ])('refuses a pass rate that is %s', (_label, rate) => {
    expect(
      decodeSuiteSummariesCursor(
        tuple([1, 'pass-rate', rate, CREATED_AT, 'suite-1']),
      ),
    ).toBeNull();
  });

  it.each([
    ['negative', -1],
    ['fractional', 2.5],
  ])('refuses a case count that is %s', (_label, count) => {
    expect(
      decodeSuiteSummariesCursor(
        tuple([1, 'cases', count, CREATED_AT, 'suite-1']),
      ),
    ).toBeNull();
  });

  it('accepts the boundary pass rates zero and one hundred', () => {
    expect(
      decodeSuiteSummariesCursor(
        tuple([1, 'pass-rate', 0, CREATED_AT, 'suite-1']),
      ),
    ).toEqual({
      sort: 'pass-rate',
      recentPassRate: 0,
      createdAt: CREATED_AT,
      id: 'suite-1',
    });
    expect(
      decodeSuiteSummariesCursor(
        tuple([1, 'pass-rate', 100, CREATED_AT, 'suite-1']),
      ),
    ).toEqual({
      sort: 'pass-rate',
      recentPassRate: 100,
      createdAt: CREATED_AT,
      id: 'suite-1',
    });
  });
});

import {
  extractSuiteIds,
  hasConfirmFlag,
  hostOf,
} from './reclassify-pending-proposals.lib';

describe('hasConfirmFlag', () => {
  it('returns true when --confirm is present', () => {
    expect(hasConfirmFlag(['node', 'script.ts', '--confirm'])).toBe(true);
  });

  it('returns false when --confirm is absent', () => {
    expect(hasConfirmFlag(['node', 'script.ts'])).toBe(false);
  });

  it('returns false for an empty argv', () => {
    expect(hasConfirmFlag([])).toBe(false);
  });
});

describe('hostOf', () => {
  it('extracts only the hostname, never credentials or the database name', () => {
    expect(
      hostOf('postgresql://user:secret@db.example.internal:5432/qably'),
    ).toBe('db.example.internal');
  });

  it('extracts the hostname from a local connection string', () => {
    expect(hostOf('postgresql://qably:qably@localhost:55432/qably_bench')).toBe(
      'localhost',
    );
  });

  it('returns a safe placeholder instead of throwing for a malformed URL', () => {
    expect(hostOf('not-a-url')).toBe('(unparseable URL)');
  });
});

describe('extractSuiteIds', () => {
  it('extracts non-null suite ids from proposal rows', () => {
    const rows = [{ suiteId: 'suite-1' }, { suiteId: 'suite-2' }];
    expect(extractSuiteIds(rows)).toEqual(['suite-1', 'suite-2']);
  });

  it('filters out null suite ids, since a job needs a real suite', () => {
    const rows = [{ suiteId: 'suite-1' }, { suiteId: null }];
    expect(extractSuiteIds(rows)).toEqual(['suite-1']);
  });

  it('returns an empty array for no rows', () => {
    expect(extractSuiteIds([])).toEqual([]);
  });
});

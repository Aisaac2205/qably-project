import { assertLocalBenchUrl } from './assert-local-bench-url';

describe('assertLocalBenchUrl', () => {
  it('accepts a localhost connection string', () => {
    expect(() =>
      assertLocalBenchUrl(
        'postgresql://bench:bench@localhost:55432/qably_bench',
      ),
    ).not.toThrow();
  });

  it('accepts a 127.0.0.1 connection string', () => {
    expect(() =>
      assertLocalBenchUrl(
        'postgresql://bench:bench@127.0.0.1:55432/qably_bench',
      ),
    ).not.toThrow();
  });

  it('refuses a remote Railway-style host', () => {
    expect(() =>
      assertLocalBenchUrl(
        'postgresql://user:pass@containers-us-west-1.railway.app:5432/railway',
      ),
    ).toThrow(/localhost or 127\.0\.0\.1/);
  });

  it('refuses a malformed connection string', () => {
    expect(() => assertLocalBenchUrl('not-a-url')).toThrow(/not a valid URL/);
  });
});

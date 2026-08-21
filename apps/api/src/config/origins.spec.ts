import { resolveAllowedOrigins, toOrigin } from './origins';

describe('toOrigin', () => {
  it('drops a trailing slash so the value matches a browser Origin header', () => {
    expect(toOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('drops path, query and hash', () => {
    expect(toOrigin('https://qably.app/dashboard?tab=runs#top')).toBe(
      'https://qably.app',
    );
  });

  it('lowercases the host', () => {
    expect(toOrigin('https://Qably.App')).toBe('https://qably.app');
  });

  it('keeps a non-default port', () => {
    expect(toOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('drops the default port for the scheme', () => {
    expect(toOrigin('https://qably.app:443')).toBe('https://qably.app');
  });

  it('throws on a value that is not a url', () => {
    expect(() => toOrigin('not a url')).toThrow(/not a url/);
  });

  it('throws on a url that has no comparable origin', () => {
    expect(() => toOrigin('localhost:3000')).toThrow(/origin/i);
  });
});

describe('resolveAllowedOrigins', () => {
  it('normalizes every entry', () => {
    expect(
      resolveAllowedOrigins('http://localhost:3000/', 'https://qably.app/app'),
    ).toEqual(['http://localhost:3000', 'https://qably.app']);
  });

  it('removes entries that differ only in trailing slash', () => {
    expect(
      resolveAllowedOrigins('http://localhost:3000', 'http://localhost:3000/'),
    ).toEqual(['http://localhost:3000']);
  });

  it('returns an empty list when given nothing', () => {
    expect(resolveAllowedOrigins()).toEqual([]);
  });
});

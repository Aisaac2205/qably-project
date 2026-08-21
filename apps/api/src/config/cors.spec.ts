import { buildCorsOptions } from './cors';

describe('buildCorsOptions', () => {
  it('allows the web app origin instead of the api origin', () => {
    expect(buildCorsOptions({ WEB_APP_URL: 'http://localhost:3000' })).toEqual(
      expect.objectContaining({ origin: ['http://localhost:3000'] }),
    );
  });

  it('normalizes a web app url written with a trailing slash', () => {
    expect(buildCorsOptions({ WEB_APP_URL: 'http://localhost:3000/' })).toEqual(
      expect.objectContaining({ origin: ['http://localhost:3000'] }),
    );
  });

  it('sends credentials so the session cookie can flow cross-origin', () => {
    expect(buildCorsOptions({ WEB_APP_URL: 'http://localhost:3000' })).toEqual(
      expect.objectContaining({ credentials: true }),
    );
  });

  it('caches the preflight response', () => {
    expect(
      buildCorsOptions({ WEB_APP_URL: 'http://localhost:3000' }).maxAge,
    ).toBeGreaterThan(0);
  });
});

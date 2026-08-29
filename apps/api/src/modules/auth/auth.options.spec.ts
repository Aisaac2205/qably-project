import type { Env } from '../../config/env';
import { buildAuthOptions } from './auth.options';

const env = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://qably:qably@localhost:5432/qably',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_APP_URL: 'http://localhost:3000',
  ENCRYPTION_KEY: 'a'.repeat(64),
  GITHUB_CLIENT_ID: 'gh-client-id',
  GITHUB_CLIENT_SECRET: 'gh-client-secret',
} as Env;

describe('buildAuthOptions', () => {
  it('trusts the web app origin so cross-origin auth calls are not rejected', () => {
    expect(buildAuthOptions(env).trustedOrigins).toEqual([
      'http://localhost:3000',
    ]);
  });

  it('normalizes a web app url written with a trailing slash', () => {
    expect(
      buildAuthOptions({ ...env, WEB_APP_URL: 'http://localhost:3000/' })
        .trustedOrigins,
    ).toEqual(['http://localhost:3000']);
  });

  it('still serves auth from the api base url', () => {
    expect(buildAuthOptions(env).baseURL).toBe('http://localhost:3001');
  });

  it('uses secure cookies only in production', () => {
    expect(buildAuthOptions(env).advanced.useSecureCookies).toBe(false);
    expect(
      buildAuthOptions({ ...env, NODE_ENV: 'production' }).advanced
        .useSecureCookies,
    ).toBe(true);
  });
});

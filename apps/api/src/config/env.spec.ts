import { parseEnv } from './env';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://qably:qably@localhost:5432/qably',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_APP_URL: 'http://localhost:3000',
  ENCRYPTION_KEY: 'a'.repeat(64),
  GITHUB_CLIENT_ID: 'gh-client-id',
  GITHUB_CLIENT_SECRET: 'gh-client-secret',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  RESEND_API_KEY: 're_test',
};

function omit<T extends object, K extends keyof T>(
  source: T,
  key: K,
): Omit<T, K> {
  const clone = { ...source };
  delete clone[key];
  return clone;
}

describe('parseEnv', () => {
  it('returns a typed config when every required variable is present', () => {
    const config = parseEnv(validEnv);

    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3001);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.REDIS_URL).toBe(validEnv.REDIS_URL);
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv(validEnv).PORT).toEqual(expect.any(Number));
  });

  it('defaults PORT to 3001 when omitted', () => {
    expect(parseEnv(omit(validEnv, 'PORT')).PORT).toBe(3001);
  });

  it('throws naming the missing variable when DATABASE_URL is absent', () => {
    expect(() => parseEnv(omit(validEnv, 'DATABASE_URL'))).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a BETTER_AUTH_SECRET shorter than 32 characters', () => {
    expect(() =>
      parseEnv({ ...validEnv, BETTER_AUTH_SECRET: 'too-short' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects an ENCRYPTION_KEY that is not 64 hex characters', () => {
    expect(() => parseEnv({ ...validEnv, ENCRYPTION_KEY: 'zz' })).toThrow(
      /ENCRYPTION_KEY/,
    );
  });

  it('throws naming the missing variable when WEB_APP_URL is absent', () => {
    expect(() => parseEnv(omit(validEnv, 'WEB_APP_URL'))).toThrow(
      /WEB_APP_URL/,
    );
  });

  it('rejects a WEB_APP_URL that is not a valid url', () => {
    expect(() =>
      parseEnv({ ...validEnv, WEB_APP_URL: 'localhost:3000' }),
    ).toThrow(/WEB_APP_URL/);
  });

  it('rejects a DATABASE_URL that is not a valid url', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('reports every missing variable in a single error', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(/REDIS_URL/);
  });

  it('starts without ANTHROPIC_API_KEY because extraction ships last', () => {
    expect(
      parseEnv(omit(validEnv, 'ANTHROPIC_API_KEY')).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });

  it('treats a blank ANTHROPIC_API_KEY as absent, matching dotenv semantics', () => {
    expect(
      parseEnv({ ...validEnv, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });

  it('starts with neither optional provider key present', () => {
    const withoutProviders = omit(
      omit(validEnv, 'ANTHROPIC_API_KEY'),
      'RESEND_API_KEY',
    );

    expect(() => parseEnv(withoutProviders)).not.toThrow();
  });

  it('starts without RESEND_API_KEY because notifications ship last', () => {
    expect(
      parseEnv(omit(validEnv, 'RESEND_API_KEY')).RESEND_API_KEY,
    ).toBeUndefined();
  });

  it('treats a blank RESEND_API_KEY as absent, matching dotenv semantics', () => {
    expect(
      parseEnv({ ...validEnv, RESEND_API_KEY: '' }).RESEND_API_KEY,
    ).toBeUndefined();
  });

  it('keeps rejecting a blank value for a variable that is required', () => {
    expect(() => parseEnv({ ...validEnv, BETTER_AUTH_SECRET: '' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});

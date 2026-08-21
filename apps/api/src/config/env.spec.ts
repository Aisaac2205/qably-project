import { parseEnv } from './env';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://qably:qably@localhost:5432/qably',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
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

  it('rejects a DATABASE_URL that is not a valid url', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('reports every missing variable in a single error', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(/REDIS_URL/);
  });
});

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
  GEMINI_API_KEY: 'gemini-test-key',
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

  it('rejects a BETTER_AUTH_URL carrying a path, which better-auth mounts its router on', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        BETTER_AUTH_URL: 'https://api.qably.dev/,https://app.qably.dev/',
      }),
    ).toThrow(/BETTER_AUTH_URL/);
  });

  it('rejects a WEB_APP_URL carrying a path so cors compares bare origins', () => {
    expect(() =>
      parseEnv({ ...validEnv, WEB_APP_URL: 'https://app.qably.dev/dashboard' }),
    ).toThrow(/WEB_APP_URL/);
  });

  it('accepts an origin written with a trailing slash', () => {
    expect(() =>
      parseEnv({ ...validEnv, BETTER_AUTH_URL: 'https://api.qably.dev/' }),
    ).not.toThrow();
  });

  it('rejects a DATABASE_URL that is not a valid url', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('reports every missing variable in a single error', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(/REDIS_URL/);
  });

  it('starts without GEMINI_API_KEY because extraction requires it only at its own boundary', () => {
    expect(
      parseEnv(omit(validEnv, 'GEMINI_API_KEY')).GEMINI_API_KEY,
    ).toBeUndefined();
  });

  it('treats a blank GEMINI_API_KEY as absent, matching dotenv semantics', () => {
    expect(
      parseEnv({ ...validEnv, GEMINI_API_KEY: '' }).GEMINI_API_KEY,
    ).toBeUndefined();
  });

  it('defaults GEMINI_MODEL when omitted', () => {
    expect(parseEnv(validEnv).GEMINI_MODEL).toBe('gemini-3.1-flash-lite');
  });

  it('accepts an explicit GEMINI_MODEL override', () => {
    expect(
      parseEnv({ ...validEnv, GEMINI_MODEL: 'gemini-2.5-pro' }).GEMINI_MODEL,
    ).toBe('gemini-2.5-pro');
  });

  it('starts with neither optional provider key present', () => {
    const withoutProviders = omit(
      omit(validEnv, 'GEMINI_API_KEY'),
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

  it('starts without RESEND_FROM_EMAIL because it is optional', () => {
    expect(parseEnv(validEnv).RESEND_FROM_EMAIL).toBeUndefined();
  });

  it('accepts a display-name sender address for RESEND_FROM_EMAIL', () => {
    expect(
      parseEnv({
        ...validEnv,
        RESEND_FROM_EMAIL: 'Qably <alerts@qably.dev>',
      }).RESEND_FROM_EMAIL,
    ).toBe('Qably <alerts@qably.dev>');
  });

  it('keeps rejecting a blank value for a variable that is required', () => {
    expect(() => parseEnv({ ...validEnv, BETTER_AUTH_SECRET: '' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('starts without AERIS_DAILY_BUDGET because an unset budget means unmetered', () => {
    expect(parseEnv(validEnv).AERIS_DAILY_BUDGET).toBeUndefined();
  });

  it('coerces a numeric AERIS_DAILY_BUDGET', () => {
    expect(
      parseEnv({ ...validEnv, AERIS_DAILY_BUDGET: '500' }).AERIS_DAILY_BUDGET,
    ).toBe(500);
  });

  it('rejects a non-positive AERIS_DAILY_BUDGET', () => {
    expect(() => parseEnv({ ...validEnv, AERIS_DAILY_BUDGET: '0' })).toThrow(
      /AERIS_DAILY_BUDGET/,
    );
  });

  it('treats a blank AERIS_DAILY_BUDGET as unmetered, as an empty hosting variable arrives', () => {
    expect(
      parseEnv({ ...validEnv, AERIS_DAILY_BUDGET: '' }).AERIS_DAILY_BUDGET,
    ).toBeUndefined();
  });

  it('treats a blank RESEND_FROM_EMAIL as absent, as an empty hosting variable arrives', () => {
    expect(
      parseEnv({ ...validEnv, RESEND_FROM_EMAIL: '' }).RESEND_FROM_EMAIL,
    ).toBeUndefined();
  });

  it('falls back to the default PORT when it is an empty string', () => {
    expect(parseEnv({ ...validEnv, PORT: '' }).PORT).toBe(3001);
  });

  it('falls back to the default GEMINI_MODEL when it is an empty string', () => {
    expect(parseEnv({ ...validEnv, GEMINI_MODEL: '' }).GEMINI_MODEL).toBe(
      'gemini-3.1-flash-lite',
    );
  });

  it('falls back to the default NODE_ENV when it is an empty string', () => {
    expect(parseEnv({ ...validEnv, NODE_ENV: '' }).NODE_ENV).toBe(
      'development',
    );
  });

  it('defaults EXTRACTION_MAX_FILES_PER_BATCH to 50 so a batch can never fan out without a bound', () => {
    expect(parseEnv(validEnv).EXTRACTION_MAX_FILES_PER_BATCH).toBe(50);
  });

  it('falls back to the default when EXTRACTION_MAX_FILES_PER_BATCH is an empty string, as an empty hosting variable arrives', () => {
    expect(
      parseEnv({ ...validEnv, EXTRACTION_MAX_FILES_PER_BATCH: '' })
        .EXTRACTION_MAX_FILES_PER_BATCH,
    ).toBe(50);
  });

  it('coerces a numeric EXTRACTION_MAX_FILES_PER_BATCH', () => {
    expect(
      parseEnv({ ...validEnv, EXTRACTION_MAX_FILES_PER_BATCH: '120' })
        .EXTRACTION_MAX_FILES_PER_BATCH,
    ).toBe(120);
  });

  it.each(['0', '-5', '2.5', 'many'])(
    'rejects EXTRACTION_MAX_FILES_PER_BATCH=%s because the cap must be a positive integer',
    (value) => {
      expect(() =>
        parseEnv({ ...validEnv, EXTRACTION_MAX_FILES_PER_BATCH: value }),
      ).toThrow(/EXTRACTION_MAX_FILES_PER_BATCH/);
    },
  );
});

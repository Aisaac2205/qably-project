import { isSourceUnavailableReason } from './source-unavailable-reason';

describe('isSourceUnavailableReason', () => {
  it.each(['http-404', 'http-401', 'http-403', 'http-500', 'http-503'])(
    'treats %s as source-unavailable',
    (reason) => {
      expect(isSourceUnavailableReason(reason)).toBe(true);
    },
  );

  it.each(['no-connection', 'timeout', 'fetch-failed'])(
    'treats %s as source-unavailable',
    (reason) => {
      expect(isSourceUnavailableReason(reason)).toBe(true);
    },
  );

  it.each([
    'ai-not-enabled',
    'quota-exhausted',
    'no-tests-found',
    'extraction-incomplete',
    'extraction-failed',
    'automation-key-not-found',
    'invalid-credentials',
    'http',
    'http-',
    'httpx-404',
  ])('does not treat %s as source-unavailable', (reason) => {
    expect(isSourceUnavailableReason(reason)).toBe(false);
  });
});

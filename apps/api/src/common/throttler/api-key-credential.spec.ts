import { generateApiKeyToken } from '../../modules/api-keys/lib/token';
import { readWellFormedApiKey } from './api-key-credential';

describe('readWellFormedApiKey', () => {
  it('returns the token of a well formed bearer credential', () => {
    const { token } = generateApiKeyToken();

    expect(readWellFormedApiKey(`Bearer ${token}`)).toBe(token);
  });

  it('returns the same token when text trails the credential', () => {
    const { token } = generateApiKeyToken();

    expect(readWellFormedApiKey(`Bearer ${token} padding`)).toBe(token);
  });

  it('rejects a bearer value that is not shaped like an api key', () => {
    expect(readWellFormedApiKey('Bearer qbly_live_abc')).toBeNull();
  });

  it('rejects a credential presented under another scheme', () => {
    const { token } = generateApiKeyToken();

    expect(readWellFormedApiKey(`Basic ${token}`)).toBeNull();
  });

  it('rejects a scheme that only differs by case', () => {
    const { token } = generateApiKeyToken();

    expect(readWellFormedApiKey(`bearer ${token}`)).toBeNull();
  });

  it('rejects the scheme with no token', () => {
    expect(readWellFormedApiKey('Bearer')).toBeNull();
    expect(readWellFormedApiKey('Bearer ')).toBeNull();
  });

  it('rejects a blank header', () => {
    expect(readWellFormedApiKey('   ')).toBeNull();
  });

  it('rejects a header that is not a string', () => {
    expect(readWellFormedApiKey(undefined)).toBeNull();
    expect(readWellFormedApiKey(['Bearer x'])).toBeNull();
  });
});

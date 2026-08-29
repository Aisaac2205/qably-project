import {
  API_KEY_PREFIX,
  generateApiKeyToken,
  hashApiKeySecret,
  parseApiKeyToken,
  secretMatches,
} from './token';

describe('generateApiKeyToken', () => {
  it('prefixes the token so leaked keys are detectable by secret scanning', () => {
    const generated = generateApiKeyToken();

    expect(generated.token.startsWith(`${API_KEY_PREFIX}_`)).toBe(true);
  });

  it('embeds the lookup id so authentication resolves one row instead of scanning', () => {
    const generated = generateApiKeyToken();

    expect(generated.token).toContain(generated.lookupId);
    expect(parseApiKeyToken(generated.token)?.lookupId).toBe(
      generated.lookupId,
    );
  });

  it('never repeats a secret across generations', () => {
    const first = generateApiKeyToken();
    const second = generateApiKeyToken();

    expect(first.secret).not.toBe(second.secret);
    expect(first.lookupId).not.toBe(second.lookupId);
  });

  it('exposes the last four characters of the token for masked display', () => {
    const generated = generateApiKeyToken();

    expect(generated.lastFour).toBe(generated.token.slice(-4));
  });
});

describe('parseApiKeyToken', () => {
  it('rejects a token that does not carry the platform prefix', () => {
    expect(parseApiKeyToken('sk_live_deadbeef_cafe')).toBeNull();
  });

  it('rejects a token without both lookup id and secret', () => {
    expect(parseApiKeyToken(`${API_KEY_PREFIX}_onlylookup`)).toBeNull();
  });

  it('rejects an empty token', () => {
    expect(parseApiKeyToken('')).toBeNull();
  });

  it('splits a well formed token into its lookup id and secret', () => {
    const generated = generateApiKeyToken();

    expect(parseApiKeyToken(generated.token)).toEqual({
      lookupId: generated.lookupId,
      secret: generated.secret,
    });
  });
});

describe('hashApiKeySecret', () => {
  it('never stores the secret in recoverable form', () => {
    const generated = generateApiKeyToken();

    const hashed = hashApiKeySecret(generated.secret);

    expect(hashed).not.toContain(generated.secret);
    expect(hashed).not.toBe(generated.secret);
  });

  it('is deterministic so a stored hash can be matched later', () => {
    const generated = generateApiKeyToken();

    expect(hashApiKeySecret(generated.secret)).toBe(
      hashApiKeySecret(generated.secret),
    );
  });
});

describe('secretMatches', () => {
  it('accepts the secret that produced the stored hash', () => {
    const generated = generateApiKeyToken();

    expect(
      secretMatches(generated.secret, hashApiKeySecret(generated.secret)),
    ).toBe(true);
  });

  it('rejects a different secret', () => {
    const generated = generateApiKeyToken();
    const other = generateApiKeyToken();

    expect(
      secretMatches(other.secret, hashApiKeySecret(generated.secret)),
    ).toBe(false);
  });

  it('rejects a stored hash of the wrong length without throwing', () => {
    const generated = generateApiKeyToken();

    expect(secretMatches(generated.secret, 'not-a-hash')).toBe(false);
  });
});

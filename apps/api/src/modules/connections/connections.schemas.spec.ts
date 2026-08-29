import {
  createConnectionSchema,
  updateConnectionSchema,
} from './connections.schemas';

describe('createConnectionSchema', () => {
  it('trims the name and accepts a github connection', () => {
    const parsed = createConnectionSchema.parse({
      provider: 'GITHUB',
      name: '  Primary  ',
      repo: 'acme/shop',
      token: 'ghp_abc123',
    });

    expect(parsed).toEqual({
      provider: 'GITHUB',
      name: 'Primary',
      repo: 'acme/shop',
      token: 'ghp_abc123',
    });
  });

  it('accepts a bitbucket connection', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'BITBUCKET',
        name: 'Primary',
        repo: 'acme/shop',
        token: 'bb_abc123',
      }).success,
    ).toBe(true);
  });

  it('rejects a repo given as a full url', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'https://github.com/acme/shop',
        token: 'ghp_abc123',
      }).success,
    ).toBe(false);
  });

  it('rejects an unsupported provider', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITLAB',
        name: 'Primary',
        repo: 'acme/shop',
        token: 'ghp_abc123',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty token', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'acme/shop',
        token: '',
      }).success,
    ).toBe(false);
  });

  it('rejects a name that is only whitespace', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITHUB',
        name: '   ',
        repo: 'acme/shop',
        token: 'ghp_abc123',
      }).success,
    ).toBe(false);
  });
});

describe('updateConnectionSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateConnectionSchema.safeParse({}).success).toBe(false);
  });

  it('allows renaming alone', () => {
    expect(updateConnectionSchema.parse({ name: 'Renamed' })).toEqual({
      name: 'Renamed',
    });
  });

  it('allows rotating the token alone', () => {
    expect(updateConnectionSchema.parse({ token: 'ghp_new-token' })).toEqual({
      token: 'ghp_new-token',
    });
  });
});

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
    });

    expect(parsed).toEqual({
      provider: 'GITHUB',
      name: 'Primary',
      repo: 'acme/shop',
    });
  });

  it('accepts a bitbucket connection', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'BITBUCKET',
        name: 'Primary',
        repo: 'acme/shop',
      }).success,
    ).toBe(true);
  });

  it('rejects a repo given as a full url', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'https://github.com/acme/shop',
      }).success,
    ).toBe(false);
  });

  it('rejects an unsupported provider', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITLAB',
        name: 'Primary',
        repo: 'acme/shop',
      }).success,
    ).toBe(false);
  });

  it('ignores a pasted token because the login already carries the credential', () => {
    expect(
      createConnectionSchema.parse({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'acme/shop',
      }),
    ).not.toHaveProperty('token');
  });

  it('rejects a name that is only whitespace', () => {
    expect(
      createConnectionSchema.safeParse({
        provider: 'GITHUB',
        name: '   ',
        repo: 'acme/shop',
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

  it('refuses an update that carries only a token', () => {
    expect(updateConnectionSchema.safeParse({ token: 'ghp_new' }).success).toBe(
      false,
    );
  });
});

import { setAccessTokenSchema } from './repository.schemas';

describe('setAccessTokenSchema', () => {
  it('accepts a non-empty token up to 500 characters', () => {
    expect(setAccessTokenSchema.safeParse({ token: 'ghp_abc' }).success).toBe(
      true,
    );
  });

  it('rejects an empty token', () => {
    expect(setAccessTokenSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('rejects a token longer than 500 characters', () => {
    expect(
      setAccessTokenSchema.safeParse({ token: 'a'.repeat(501) }).success,
    ).toBe(false);
  });
});

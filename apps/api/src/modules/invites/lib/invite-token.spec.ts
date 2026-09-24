import { generateInviteToken, hashInviteToken } from './invite-token';

describe('generateInviteToken', () => {
  it('returns a url-safe token decoding to 32 random bytes', () => {
    const token = generateInviteToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url').length).toBe(32);
  });

  it('never returns the same token twice', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => generateInviteToken()),
    );

    expect(tokens.size).toBe(50);
  });
});

describe('hashInviteToken', () => {
  it('hashes a token to a 64-character hex sha256 digest', () => {
    const hash = hashInviteToken('some-raw-token-value');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const token = generateInviteToken();

    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
  });

  it('never reveals the raw token from the hash alone', () => {
    const token = generateInviteToken();
    const hash = hashInviteToken(token);

    expect(hash).not.toContain(token);
    expect(hash).not.toBe(token);
  });
});

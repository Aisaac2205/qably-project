import { generateApiKeyToken } from '../../modules/api-keys/lib/token';
import { CredentialThrottlerGuard } from './credential-throttler.guard';

class ExposedGuard extends CredentialThrottlerGuard {
  track(request: { headers?: Record<string, unknown>; ip?: string }) {
    return this.getTracker(request);
  }
}

const guard = new ExposedGuard({} as never, {} as never, {} as never);

function bearer(token: string): string {
  return `Bearer ${token}`;
}

describe('CredentialThrottlerGuard', () => {
  it('buckets by credential when a well formed key is presented', async () => {
    const tracker = await guard.track({
      headers: { authorization: bearer(generateApiKeyToken().token) },
      ip: '10.0.0.1',
    });

    expect(tracker.startsWith('credential:')).toBe(true);
  });

  it('never puts the raw key in the tracker', async () => {
    const { token, secret } = generateApiKeyToken();

    const tracker = await guard.track({
      headers: { authorization: bearer(token) },
    });

    expect(tracker).not.toContain(secret);
    expect(tracker).not.toContain(token);
  });

  it('gives two keys two buckets', async () => {
    const first = await guard.track({
      headers: { authorization: bearer(generateApiKeyToken().token) },
      ip: '10.0.0.1',
    });
    const second = await guard.track({
      headers: { authorization: bearer(generateApiKeyToken().token) },
      ip: '10.0.0.1',
    });

    expect(first).not.toBe(second);
  });

  it('gives one key one bucket across addresses', async () => {
    const { token } = generateApiKeyToken();

    const first = await guard.track({
      headers: { authorization: bearer(token) },
      ip: '10.0.0.1',
    });
    const second = await guard.track({
      headers: { authorization: bearer(token) },
      ip: '10.0.0.2',
    });

    expect(first).toBe(second);
  });

  it('does not open a new bucket when text is appended to a key', async () => {
    const { token } = generateApiKeyToken();

    const plain = await guard.track({
      headers: { authorization: bearer(token) },
      ip: '10.0.0.1',
    });
    const padded = await guard.track({
      headers: { authorization: `${bearer(token)} padding` },
      ip: '10.0.0.1',
    });

    expect(padded).toBe(plain);
  });

  it('falls back to the address when the credential is not shaped like a key', async () => {
    const tracker = await guard.track({
      headers: { authorization: 'Bearer qbly_live_abc' },
      ip: '10.0.0.1',
    });

    expect(tracker).toBe('ip:10.0.0.1');
  });

  it('gives rotating garbage the same bucket', async () => {
    const first = await guard.track({
      headers: { authorization: 'Bearer garbage-one' },
      ip: '10.0.0.1',
    });
    const second = await guard.track({
      headers: { authorization: 'Bearer garbage-two' },
      ip: '10.0.0.1',
    });

    expect(first).toBe(second);
  });

  it('falls back to the address for another scheme', async () => {
    const tracker = await guard.track({
      headers: { authorization: `Basic ${generateApiKeyToken().token}` },
      ip: '10.0.0.1',
    });

    expect(tracker).toBe('ip:10.0.0.1');
  });

  it('falls back to the address for anonymous callers', async () => {
    const tracker = await guard.track({ headers: {}, ip: '10.0.0.1' });

    expect(tracker).toBe('ip:10.0.0.1');
  });

  it('tolerates a blank authorization header', async () => {
    const tracker = await guard.track({
      headers: { authorization: '   ' },
      ip: '10.0.0.1',
    });

    expect(tracker).toBe('ip:10.0.0.1');
  });

  it('tolerates a request with no address at all', async () => {
    const tracker = await guard.track({ headers: {} });

    expect(tracker).toBe('ip:unknown');
  });
});

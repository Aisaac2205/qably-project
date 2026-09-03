import { CredentialThrottlerGuard } from './credential-throttler.guard';

class ExposedGuard extends CredentialThrottlerGuard {
  track(request: { headers?: Record<string, unknown>; ip?: string }) {
    return this.getTracker(request);
  }
}

const guard = new ExposedGuard({} as never, {} as never, {} as never);

describe('CredentialThrottlerGuard', () => {
  it('buckets by credential when one is presented', async () => {
    const tracker = await guard.track({
      headers: { authorization: 'Bearer qbly_live_abc' },
      ip: '10.0.0.1',
    });

    expect(tracker.startsWith('credential:')).toBe(true);
  });

  it('never puts the raw credential in the tracker', async () => {
    const tracker = await guard.track({
      headers: { authorization: 'Bearer qbly_live_abc' },
    });

    expect(tracker).not.toContain('qbly_live_abc');
  });

  it('gives two credentials two buckets', async () => {
    const first = await guard.track({
      headers: { authorization: 'Bearer one' },
      ip: '10.0.0.1',
    });
    const second = await guard.track({
      headers: { authorization: 'Bearer two' },
      ip: '10.0.0.1',
    });

    expect(first).not.toBe(second);
  });

  it('gives one credential one bucket across addresses', async () => {
    const first = await guard.track({
      headers: { authorization: 'Bearer same' },
      ip: '10.0.0.1',
    });
    const second = await guard.track({
      headers: { authorization: 'Bearer same' },
      ip: '10.0.0.2',
    });

    expect(first).toBe(second);
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

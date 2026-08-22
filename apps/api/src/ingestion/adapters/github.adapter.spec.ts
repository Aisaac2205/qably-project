import { createHmac } from 'node:crypto';
import { GithubAdapter } from './github.adapter';

const secret = 'webhook-secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function build(): GithubAdapter {
  return new GithubAdapter();
}

const pushPayload = {
  ref: 'refs/heads/main',
  after: 'a'.repeat(40),
  repository: {
    full_name: 'acme/shop',
    html_url: 'https://github.com/acme/shop',
  },
  pusher: { name: 'ada' },
  head_commit: {
    id: 'a'.repeat(40),
    message: 'Add checkout guard',
    url: 'https://github.com/acme/shop/commit/aaa',
  },
};

describe('GithubAdapter.verifySignature', () => {
  it('accepts a body signed with the connection secret', () => {
    const body = JSON.stringify(pushPayload);

    expect(
      build().verifySignature(
        body,
        { 'x-hub-signature-256': sign(body) },
        secret,
      ),
    ).toBe(true);
  });

  it('rejects a body signed with a different secret', () => {
    const body = JSON.stringify(pushPayload);
    const foreign = `sha256=${createHmac('sha256', 'other').update(body).digest('hex')}`;

    expect(
      build().verifySignature(body, { 'x-hub-signature-256': foreign }, secret),
    ).toBe(false);
  });

  it('rejects a tampered body carrying a valid signature for the original', () => {
    const body = JSON.stringify(pushPayload);
    const signature = sign(body);

    expect(
      build().verifySignature(
        `${body} `,
        { 'x-hub-signature-256': signature },
        secret,
      ),
    ).toBe(false);
  });

  it('rejects a request with no signature header', () => {
    expect(build().verifySignature('{}', {}, secret)).toBe(false);
  });
});

describe('GithubAdapter.normalize', () => {
  it('normalizes a push event', () => {
    const event = build().normalize(pushPayload, {
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-1',
    });

    expect(event).toEqual({
      eventId: 'delivery-1',
      provider: 'GITHUB',
      kind: 'push',
      repo: 'acme/shop',
      branch: 'main',
      commitSha: 'a'.repeat(40),
      author: 'ada',
      title: 'Add checkout guard',
      url: 'https://github.com/acme/shop/commit/aaa',
    });
  });

  it('normalizes an opened pull request', () => {
    const event = build().normalize(
      {
        action: 'opened',
        number: 42,
        pull_request: {
          head: { ref: 'feat/checkout', sha: 'b'.repeat(40) },
          title: 'Guard the checkout',
          html_url: 'https://github.com/acme/shop/pull/42',
          user: { login: 'ada' },
        },
        repository: { full_name: 'acme/shop' },
      },
      { 'x-github-event': 'pull_request', 'x-github-delivery': 'delivery-2' },
    );

    expect(event).toEqual({
      eventId: 'delivery-2',
      provider: 'GITHUB',
      kind: 'pull_request',
      repo: 'acme/shop',
      branch: 'feat/checkout',
      commitSha: 'b'.repeat(40),
      author: 'ada',
      title: 'Guard the checkout',
      url: 'https://github.com/acme/shop/pull/42',
    });
  });

  it('ignores event types outside push and pull_request', () => {
    expect(
      build().normalize(pushPayload, {
        'x-github-event': 'star',
        'x-github-delivery': 'delivery-3',
      }),
    ).toBeNull();
  });

  it('ignores a pull request action that is not opened or synchronize', () => {
    expect(
      build().normalize(
        { action: 'labeled', pull_request: {}, repository: {} },
        { 'x-github-event': 'pull_request', 'x-github-delivery': 'd' },
      ),
    ).toBeNull();
  });

  it('ignores a branch deletion push with no head commit', () => {
    expect(
      build().normalize(
        {
          ref: 'refs/heads/main',
          head_commit: null,
          repository: { full_name: 'acme/shop' },
        },
        { 'x-github-event': 'push', 'x-github-delivery': 'd' },
      ),
    ).toBeNull();
  });
});

import { createHmac } from 'node:crypto';
import { BitbucketAdapter } from './bitbucket.adapter';

const secret = 'webhook-secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function build(): BitbucketAdapter {
  return new BitbucketAdapter();
}

const pushPayload = {
  actor: { display_name: 'Ada Lovelace' },
  repository: { full_name: 'acme/shop' },
  push: {
    changes: [
      {
        new: {
          name: 'main',
          target: {
            hash: 'c'.repeat(40),
            message: 'Add checkout guard',
            links: {
              html: { href: 'https://bitbucket.org/acme/shop/commits/ccc' },
            },
          },
        },
      },
    ],
  },
};

describe('BitbucketAdapter.verifySignature', () => {
  it('accepts a body signed with the connection secret', () => {
    const body = JSON.stringify(pushPayload);

    expect(
      build().verifySignature(body, { 'x-hub-signature': sign(body) }, secret),
    ).toBe(true);
  });

  it('rejects a body signed with a different secret', () => {
    const body = JSON.stringify(pushPayload);
    const foreign = `sha256=${createHmac('sha256', 'other').update(body).digest('hex')}`;

    expect(
      build().verifySignature(body, { 'x-hub-signature': foreign }, secret),
    ).toBe(false);
  });

  it('rejects a request with no signature header', () => {
    expect(build().verifySignature('{}', {}, secret)).toBe(false);
  });
});

describe('BitbucketAdapter.normalize', () => {
  it('normalizes a repository push', () => {
    const event = build().normalize(pushPayload, {
      'x-event-key': 'repo:push',
      'x-request-uuid': 'uuid-1',
    });

    expect(event).toEqual({
      eventId: 'uuid-1',
      provider: 'BITBUCKET',
      kind: 'push',
      repo: 'acme/shop',
      branch: 'main',
      commitSha: 'c'.repeat(40),
      author: 'Ada Lovelace',
      title: 'Add checkout guard',
      url: 'https://bitbucket.org/acme/shop/commits/ccc',
    });
  });

  it('normalizes a created pull request', () => {
    const event = build().normalize(
      {
        actor: { display_name: 'Ada Lovelace' },
        repository: { full_name: 'acme/shop' },
        pullrequest: {
          title: 'Guard the checkout',
          source: {
            branch: { name: 'feat/checkout' },
            commit: { hash: 'd'.repeat(12) },
          },
          links: {
            html: { href: 'https://bitbucket.org/acme/shop/pull-requests/7' },
          },
        },
      },
      { 'x-event-key': 'pullrequest:created', 'x-request-uuid': 'uuid-2' },
    );

    expect(event).toEqual({
      eventId: 'uuid-2',
      provider: 'BITBUCKET',
      kind: 'pull_request',
      repo: 'acme/shop',
      branch: 'feat/checkout',
      commitSha: 'd'.repeat(12),
      author: 'Ada Lovelace',
      title: 'Guard the checkout',
      url: 'https://bitbucket.org/acme/shop/pull-requests/7',
    });
  });

  it('ignores event keys outside push and pull request creation', () => {
    expect(
      build().normalize(pushPayload, {
        'x-event-key': 'repo:fork',
        'x-request-uuid': 'uuid-3',
      }),
    ).toBeNull();
  });

  it('ignores a branch deletion push where the change has no new target', () => {
    expect(
      build().normalize(
        {
          repository: { full_name: 'acme/shop' },
          push: { changes: [{ new: null }] },
        },
        { 'x-event-key': 'repo:push', 'x-request-uuid': 'uuid-4' },
      ),
    ).toBeNull();
  });
});

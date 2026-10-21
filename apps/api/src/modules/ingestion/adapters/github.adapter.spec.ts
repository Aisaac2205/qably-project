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
    default_branch: 'main',
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
      defaultBranch: 'main',
      commitSha: 'a'.repeat(40),
      author: 'ada',
      title: 'Add checkout guard',
      url: 'https://github.com/acme/shop/commit/aaa',
      changedFiles: [],
      beforeSha: null,
      forced: false,
      commits: [],
      commitsTruncated: false,
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
      defaultBranch: null,
      commitSha: 'b'.repeat(40),
      author: 'ada',
      title: 'Guard the checkout',
      url: 'https://github.com/acme/shop/pull/42',
      changedFiles: [],
      beforeSha: null,
      forced: false,
      commits: [],
      commitsTruncated: false,
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

describe('GithubAdapter.normalize default branch', () => {
  const pushHeader = {
    'x-github-event': 'push',
    'x-github-delivery': 'delivery-default-branch',
  };

  function pushWith(repository: Record<string, unknown>) {
    return build().normalize(
      { ...pushPayload, repository: { full_name: 'acme/shop', ...repository } },
      pushHeader,
    );
  }

  it('reads the repository default branch from a push on any branch', () => {
    const event = build().normalize(
      { ...pushPayload, ref: 'refs/heads/feat/cart' },
      pushHeader,
    );

    expect(event?.branch).toBe('feat/cart');
    expect(event?.defaultBranch).toBe('main');
  });

  it('trims the default branch', () => {
    expect(pushWith({ default_branch: '  develop \n' })?.defaultBranch).toBe(
      'develop',
    );
  });

  it('trims the pushed branch too, so the two names compare on equal terms', () => {
    const event = build().normalize(
      { ...pushPayload, ref: 'refs/heads/develop \n' },
      pushHeader,
    );

    expect(event?.branch).toBe('develop');
  });

  it('trims the head branch of a pull request', () => {
    const event = build().normalize(
      {
        action: 'opened',
        repository: { full_name: 'acme/shop' },
        pull_request: {
          head: { ref: ' feat/cart ', sha: 'b'.repeat(40) },
          title: 'Guard the cart',
          html_url: 'https://github.com/acme/shop/pull/7',
          user: { login: 'ada' },
        },
      },
      { 'x-github-event': 'pull_request', 'x-github-delivery': 'delivery-pr' },
    );

    expect(event?.branch).toBe('feat/cart');
  });

  it.each([
    ['missing', {}],
    ['empty', { default_branch: '' }],
    ['blank', { default_branch: '   ' }],
    ['not a string', { default_branch: 7 }],
    ['null', { default_branch: null }],
  ])('has no default branch when the field is %s', (_label, repository) => {
    expect(pushWith(repository)?.defaultBranch).toBeNull();
  });

  it('reads the default branch of the repository a pull request targets', () => {
    const event = build().normalize(
      {
        action: 'synchronize',
        repository: { full_name: 'acme/shop', default_branch: 'main' },
        pull_request: {
          head: {
            ref: 'feat/cart',
            sha: 'b'.repeat(40),
            repo: { full_name: 'ada/shop', default_branch: 'trunk' },
          },
          title: 'Guard the cart',
          html_url: 'https://github.com/acme/shop/pull/7',
          user: { login: 'ada' },
        },
      },
      { 'x-github-event': 'pull_request', 'x-github-delivery': 'delivery-pr' },
    );

    expect(event?.defaultBranch).toBe('main');
  });

  it('has no default branch for a pull request payload that omits it', () => {
    const event = build().normalize(
      {
        action: 'opened',
        repository: { full_name: 'acme/shop' },
        pull_request: {
          head: { ref: 'feat/cart', sha: 'b'.repeat(40) },
          title: 'Guard the cart',
          html_url: 'https://github.com/acme/shop/pull/7',
          user: { login: 'ada' },
        },
      },
      { 'x-github-event': 'pull_request', 'x-github-delivery': 'delivery-pr' },
    );

    expect(event?.defaultBranch).toBeNull();
  });
});

describe('GithubAdapter.normalize changed files', () => {
  it('collects added and modified paths from a push head commit', () => {
    const event = build().normalize(
      {
        ...pushPayload,
        head_commit: {
          ...pushPayload.head_commit,
          added: ['src/cart/cart.spec.ts'],
          modified: ['src/cart/cart.ts', 'README.md'],
          removed: ['src/cart/legacy.spec.ts'],
        },
      },
      { 'x-github-event': 'push', 'x-github-delivery': 'delivery-files' },
    );

    expect(event?.changedFiles).toEqual([
      'src/cart/cart.spec.ts',
      'src/cart/cart.ts',
      'README.md',
    ]);
  });

  it('yields no changed files when the push head commit omits them', () => {
    const event = build().normalize(pushPayload, {
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-empty',
    });

    expect(event?.changedFiles).toEqual([]);
  });

  it('yields no changed files for a pull request payload', () => {
    const event = build().normalize(
      {
        action: 'opened',
        repository: { full_name: 'acme/shop' },
        pull_request: {
          head: { ref: 'feat/cart', sha: 'b'.repeat(40) },
          title: 'Guard the cart',
          html_url: 'https://github.com/acme/shop/pull/7',
          user: { login: 'ada' },
        },
      },
      { 'x-github-event': 'pull_request', 'x-github-delivery': 'delivery-pr' },
    );

    expect(event?.changedFiles).toEqual([]);
  });
});

const pushHeaders = {
  'x-github-event': 'push',
  'x-github-delivery': 'delivery-commits',
};

type CommitFixture = Record<string, unknown>;

function sha(n: number): string {
  return n.toString(16).padStart(40, '0');
}

function commitOf(n: number, extra: CommitFixture = {}): CommitFixture {
  return { id: sha(n), message: `commit ${n}`, ...extra };
}

// Mirrors a real delivery: oldest commit first, head_commit and after equal to
// the last one. Overrides model the payloads that deviate from that.
function pushOf(commits: unknown[], extra: CommitFixture = {}) {
  const head = commits[commits.length - 1] as CommitFixture;

  return {
    ref: 'refs/heads/main',
    repository: { full_name: 'acme/shop' },
    pusher: { name: 'ada' },
    after: head.id,
    head_commit: head,
    commits,
    ...extra,
  };
}

function normalizePush(payload: unknown) {
  return build().normalize(payload, pushHeaders);
}

function changedFilesOf(commits: unknown[], extra: CommitFixture = {}) {
  return normalizePush(pushOf(commits, extra))?.changedFiles;
}

function attributedFilesOf(commits: unknown[], extra: CommitFixture = {}) {
  return normalizePush(pushOf(commits, extra))?.commits.map(
    (entry) => entry.attributedFiles,
  );
}

describe('GithubAdapter.normalize pushed commits', () => {
  it('lists every commit of a multi-commit push in delivered order', () => {
    const event = normalizePush(
      pushOf([
        commitOf(1, {
          message: 'feat: add cart\n\nLonger body of the first commit',
          author: {
            username: 'ada',
            name: 'Ada Lovelace',
            email: 'ada@acme.dev',
          },
          timestamp: '2026-03-01T10:00:00+02:00',
          url: 'https://github.com/acme/shop/commit/1',
          added: ['src/cart.spec.ts'],
        }),
        commitOf(2, {
          message: '  fix: guard the checkout  \r\nbody',
          author: { name: 'Grace Hopper' },
          timestamp: '2026-03-01T11:00:00Z',
          modified: ['src/cart.ts'],
        }),
        commitOf(3, { message: 'chore: bump' }),
      ]),
    );

    expect(event?.commitSha).toBe(sha(3));
    expect(event?.commits).toEqual([
      {
        sha: sha(1),
        position: 0,
        message: 'feat: add cart',
        author: 'ada',
        committedAt: '2026-03-01T10:00:00+02:00',
        url: 'https://github.com/acme/shop/commit/1',
        attributedFiles: ['src/cart.spec.ts'],
      },
      {
        sha: sha(2),
        position: 1,
        message: 'fix: guard the checkout',
        author: 'Grace Hopper',
        committedAt: '2026-03-01T11:00:00Z',
        url: null,
        attributedFiles: ['src/cart.ts'],
      },
      {
        sha: sha(3),
        position: 2,
        message: 'chore: bump',
        author: 'unknown',
        committedAt: null,
        url: null,
        attributedFiles: [],
      },
    ]);
  });

  it('falls back from username to name to unknown, ignoring blank and non-string values', () => {
    const event = normalizePush(
      pushOf([
        commitOf(1, { author: { username: '  ', name: 'Grace Hopper' } }),
        commitOf(2, { author: { username: 42, name: null } }),
        commitOf(3, { author: 'ada' }),
      ]),
    );

    expect(event?.commits.map((entry) => entry.author)).toEqual([
      'Grace Hopper',
      'unknown',
      'unknown',
    ]);
  });

  it.each([
    ['an offset', '2026-03-01T10:00:00+02:00'],
    ['a negative offset', '2026-03-01T10:00:00-05:30'],
    ['Z', '2026-03-01T11:00:00Z'],
    ['fractional seconds', '2026-03-01T11:00:00.123Z'],
  ])(
    'keeps an ISO 8601 timestamp with %s as delivered',
    (_label, timestamp) => {
      const event = normalizePush(pushOf([commitOf(1, { timestamp })]));

      expect(event?.commits[0].committedAt).toBe(timestamp);
    },
  );

  it.each([
    ['text', 'not-a-date'],
    ['a number', 1772000000],
    ['a missing value', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a date without a time', '2026-03-01'],
    ['a time without an offset', '2026-03-01T10:00:00'],
    ['a space instead of the T separator', '2026-03-01 10:00:00Z'],
    ['an offset without a colon', '2026-03-01T10:00:00+0200'],
    ['an RFC 2822 date', 'Sun, 01 Mar 2026 10:00:00 GMT'],
    ['a long-form date', 'March 1, 2026 10:00 UTC'],
    ['a bare year', '2026'],
    ['an impossible month', '2026-13-01T10:00:00Z'],
    ['an impossible hour', '2026-03-01T25:00:00Z'],
    ['trailing text after a valid timestamp', '2026-03-01T10:00:00Z later'],
  ])('nulls a timestamp that is %s', (_label, timestamp) => {
    const event = normalizePush(pushOf([commitOf(1, { timestamp })]));

    expect(event?.commits[0].committedAt).toBeNull();
  });

  it('keeps only the first line of a message, capped at 200 characters', () => {
    const event = normalizePush(
      pushOf([
        commitOf(1, { message: 'x'.repeat(250) }),
        commitOf(2, { message: 42 }),
        commitOf(3, { message: `${'x'.repeat(199)}\u{1F600} tail` }),
      ]),
    );

    expect(event?.commits.map((entry) => entry.message)).toEqual([
      'x'.repeat(200),
      '',
      'x'.repeat(199),
    ]);
  });

  it('lowercases commit shas and skips entries without a valid 40-hex id', () => {
    const event = normalizePush(
      pushOf([
        { id: 'A'.repeat(40), message: 'uppercase sha' },
        { id: 'abc123', message: 'short sha' },
        { id: 'g'.repeat(40), message: 'not hex' },
        { id: 12345, message: 'numeric id' },
        { message: 'no id' },
        'not an object',
        null,
        commitOf(2),
      ]),
    );

    expect(event?.commits).toEqual([
      expect.objectContaining({ sha: 'a'.repeat(40), position: 0 }),
      expect.objectContaining({ sha: sha(2), position: 1 }),
    ]);
  });

  it.each([
    ['a sha', 'B'.repeat(40), 'b'.repeat(40)],
    ['the all-zero sha of a newly created ref', '0'.repeat(40), null],
    ['missing', undefined, null],
    ['not a string', 123, null],
    ['not a 40-hex sha', 'abc', null],
  ])('reads before when it is %s', (_label, before, expected) => {
    const event = normalizePush(pushOf([commitOf(1)], { before }));

    expect(event?.beforeSha).toBe(expected);
  });

  it.each([
    [true, true],
    ['true', false],
    [1, false],
    [undefined, false],
  ])('reads forced=%p as %p', (forced, expected) => {
    const event = normalizePush(pushOf([commitOf(1)], { forced }));

    expect(event?.forced).toBe(expected);
  });

  it('keeps the last 250 commits, renumbers positions and flags a longer push', () => {
    const commits = Array.from({ length: 300 }, (_, index) =>
      commitOf(index + 1, { added: [`src/file-${index + 1}.spec.ts`] }),
    );

    const event = normalizePush(pushOf(commits));

    expect(event?.commits).toHaveLength(250);
    expect(event?.commits[0]).toEqual(
      expect.objectContaining({ sha: sha(51), position: 0 }),
    );
    expect(event?.commits[249]).toEqual(
      expect.objectContaining({ sha: sha(300), position: 249 }),
    );
    expect(event?.commitsTruncated).toBe(true);
    expect(event?.commits[0].attributedFiles).toEqual(['src/file-51.spec.ts']);
    expect(event?.commits[249].attributedFiles).toEqual([
      'src/file-300.spec.ts',
    ]);
    // The cap bounds the stored list only; extraction still sees every file.
    expect(event?.changedFiles).toHaveLength(300);
  });

  it('lists a repeated sha once, keeping its first occurrence and a gapless numbering', () => {
    const event = normalizePush(
      pushOf([
        commitOf(1),
        commitOf(2),
        commitOf(1, { message: 'repeated' }),
        { id: sha(2).toUpperCase(), message: 'repeated in uppercase' },
        commitOf(3),
      ]),
    );

    expect(event?.commits).toEqual([
      expect.objectContaining({
        sha: sha(1),
        position: 0,
        message: 'commit 1',
      }),
      expect.objectContaining({
        sha: sha(2),
        position: 1,
        message: 'commit 2',
      }),
      expect.objectContaining({
        sha: sha(3),
        position: 2,
        message: 'commit 3',
      }),
    ]);
    expect(event?.commitsTruncated).toBe(false);
  });

  it('does not count repeated shas against the 250-commit cap', () => {
    const commits = [
      ...Array.from({ length: 250 }, (_, index) => commitOf(index + 1)),
      commitOf(250),
    ];

    const event = normalizePush(pushOf(commits));

    expect(event?.commits).toHaveLength(250);
    expect(event?.commitsTruncated).toBe(false);
  });

  it('does not flag a push of exactly 250 commits', () => {
    const commits = Array.from({ length: 250 }, (_, index) =>
      commitOf(index + 1),
    );

    const event = normalizePush(pushOf(commits));

    expect(event?.commits).toHaveLength(250);
    expect(event?.commits[0]).toEqual(
      expect.objectContaining({ sha: sha(1), position: 0 }),
    );
    expect(event?.commitsTruncated).toBe(false);
  });

  it('flags a delivery that reaches the 2048-commit limit GitHub may have applied', () => {
    const delivered = [...Array<null>(2047).fill(null), commitOf(1)];

    const event = normalizePush(pushOf(delivered));

    expect(event?.commits).toHaveLength(1);
    expect(event?.commitsTruncated).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['not an array', 'oops'],
    ['empty', []],
    ['made only of invalid entries', [{ id: 'nope' }, null]],
  ])(
    'accepts the push with no commit list when commits is %s',
    (_label, commits) => {
      const event = normalizePush({
        ...pushPayload,
        head_commit: {
          ...pushPayload.head_commit,
          added: ['src/cart.spec.ts'],
          modified: ['src/cart.ts'],
          removed: ['src/legacy.ts'],
        },
        commits,
      });

      expect(event?.commitSha).toBe('a'.repeat(40));
      expect(event?.commits).toEqual([]);
      expect(event?.commitsTruncated).toBe(false);
      expect(event?.changedFiles).toEqual(['src/cart.spec.ts', 'src/cart.ts']);
    },
  );

  it('ignores a push that carries commits but no head commit', () => {
    expect(
      normalizePush({
        ref: 'refs/heads/main',
        repository: { full_name: 'acme/shop' },
        head_commit: null,
        commits: [commitOf(1)],
      }),
    ).toBeNull();
  });

  it('keeps pull request events metadata-only', () => {
    const event = build().normalize(
      {
        action: 'synchronize',
        repository: { full_name: 'acme/shop' },
        before: 'c'.repeat(40),
        forced: true,
        commits: [commitOf(1)],
        pull_request: {
          head: { ref: 'feat/cart', sha: 'b'.repeat(40) },
          title: 'Guard the cart',
          html_url: 'https://github.com/acme/shop/pull/7',
          user: { login: 'ada' },
        },
      },
      { 'x-github-event': 'pull_request', 'x-github-delivery': 'delivery-pr' },
    );

    expect(event).toEqual(
      expect.objectContaining({
        kind: 'pull_request',
        beforeSha: null,
        forced: false,
        commits: [],
        commitsTruncated: false,
        changedFiles: [],
      }),
    );
  });
});

describe('GithubAdapter.normalize net changed files', () => {
  it('merges added and modified paths across commits, counting a repeated change once', () => {
    expect(
      changedFilesOf([
        commitOf(1, { added: ['a.spec.ts'], modified: ['README.md'] }),
        commitOf(2, { added: ['b.spec.ts'], modified: ['a.spec.ts'] }),
        commitOf(3, { modified: ['a.spec.ts'] }),
      ]),
    ).toEqual(['a.spec.ts', 'README.md', 'b.spec.ts']);
  });

  it('includes files of earlier commits that the head commit does not touch', () => {
    expect(
      changedFilesOf([
        commitOf(1, { added: ['early.spec.ts'] }),
        commitOf(2, { modified: ['late.spec.ts'] }),
      ]),
    ).toEqual(['early.spec.ts', 'late.spec.ts']);
  });

  it('drops a file added by one commit and removed by a later one', () => {
    expect(
      changedFilesOf([
        commitOf(1, { added: ['tmp.spec.ts', 'keep.spec.ts'] }),
        commitOf(2, { removed: ['tmp.spec.ts'] }),
      ]),
    ).toEqual(['keep.spec.ts']);
  });

  it('keeps a file removed by an earlier commit and added again by a later one', () => {
    expect(
      changedFilesOf([
        commitOf(1, { removed: ['x.spec.ts'] }),
        commitOf(2, { added: ['x.spec.ts'] }),
      ]),
    ).toEqual(['x.spec.ts']);
  });

  it('keeps a re-added file at the position where it was first seen', () => {
    expect(
      changedFilesOf([
        commitOf(1, { added: ['a.spec.ts', 'x.spec.ts'] }),
        commitOf(2, { removed: ['a.spec.ts'] }),
        commitOf(3, { added: ['a.spec.ts'] }),
      ]),
    ).toEqual(['a.spec.ts', 'x.spec.ts']);
  });

  it('trusts the delivered order when the last commit matches head_commit and after is absent', () => {
    expect(
      changedFilesOf(
        [
          commitOf(1, { added: ['a.spec.ts'] }),
          commitOf(2, { removed: ['a.spec.ts'] }),
        ],
        { after: undefined },
      ),
    ).toEqual([]);
  });

  describe('when the last delivered commit is not the head', () => {
    // Newest first: the head sits at the front, so the delivered order is
    // not chronological and removals of earlier commits cannot be replayed.
    it('unions added and modified paths minus the head removals', () => {
      const head = commitOf(3, {
        modified: ['c.spec.ts'],
        removed: ['b.spec.ts'],
      });

      const event = normalizePush(
        pushOf(
          [
            head,
            commitOf(2, { added: ['b.spec.ts'] }),
            commitOf(1, { added: ['a.spec.ts'], modified: ['c.spec.ts'] }),
          ],
          { after: sha(3), head_commit: head },
        ),
      );

      expect(event?.commitSha).toBe(sha(3));
      expect(event?.changedFiles).toEqual(['c.spec.ts', 'a.spec.ts']);
    });

    it('ignores removals made by commits other than the head', () => {
      const head = commitOf(3, { modified: ['z.spec.ts'] });

      const event = normalizePush(
        pushOf(
          [
            head,
            commitOf(2, { removed: ['a.spec.ts'] }),
            commitOf(1, { added: ['a.spec.ts'] }),
          ],
          { after: sha(3), head_commit: head },
        ),
      );

      expect(event?.changedFiles).toEqual(['z.spec.ts', 'a.spec.ts']);
    });

    it('still extracts the head commit files when the head was not delivered', () => {
      const event = normalizePush(
        pushOf(
          [
            commitOf(1, { added: ['a.spec.ts'] }),
            commitOf(2, { added: ['b.spec.ts'] }),
          ],
          {
            after: sha(3),
            head_commit: commitOf(3, { added: ['head.spec.ts'] }),
          },
        ),
      );

      expect(event?.changedFiles).toEqual([
        'a.spec.ts',
        'b.spec.ts',
        'head.spec.ts',
      ]);
    });
  });

  it('ignores path entries that are not strings', () => {
    expect(
      changedFilesOf([
        commitOf(1, {
          added: ['a.spec.ts', 5, null, {}],
          modified: 'b.spec.ts',
          removed: [7],
        }),
      ]),
    ).toEqual(['a.spec.ts']);

    expect(
      normalizePush({
        ...pushPayload,
        head_commit: {
          ...pushPayload.head_commit,
          added: [1, 'x.spec.ts'],
          modified: null,
        },
      })?.changedFiles,
    ).toEqual(['x.spec.ts']);
  });
});

describe('GithubAdapter.normalize attributed files per commit', () => {
  it('lists the paths a commit added, modified and removed, in that order', () => {
    expect(
      attributedFilesOf([
        commitOf(1, {
          removed: ['gone.spec.ts'],
          modified: ['changed.spec.ts'],
          added: ['new.spec.ts'],
        }),
      ]),
    ).toEqual([['new.spec.ts', 'changed.spec.ts', 'gone.spec.ts']]);
  });

  it('lists a path once even when the commit reports it under several lists', () => {
    expect(
      attributedFilesOf([
        commitOf(1, {
          added: ['a.spec.ts', 'a.spec.ts'],
          modified: ['a.spec.ts', 'b.spec.ts'],
          removed: ['b.spec.ts'],
        }),
      ]),
    ).toEqual([['a.spec.ts', 'b.spec.ts']]);
  });

  it('keeps the attributed files of each commit apart', () => {
    expect(
      attributedFilesOf([
        commitOf(1, { added: ['a.spec.ts'] }),
        commitOf(2, { modified: ['a.spec.ts', 'b.spec.ts'] }),
        commitOf(3, { removed: ['a.spec.ts'] }),
      ]),
    ).toEqual([['a.spec.ts'], ['a.spec.ts', 'b.spec.ts'], ['a.spec.ts']]);
  });

  it('attributes no files to a commit that reports none', () => {
    expect(attributedFilesOf([commitOf(1)])).toEqual([[]]);
  });

  it('ignores lists that are not arrays and entries that are not strings', () => {
    expect(
      attributedFilesOf([
        commitOf(1, {
          added: ['a.spec.ts', 5, null, {}, ['nested.spec.ts']],
          modified: 'b.spec.ts',
          removed: { 0: 'c.spec.ts' },
        }),
        commitOf(2, { added: null, modified: 7, removed: undefined }),
      ]),
    ).toEqual([['a.spec.ts'], []]);
  });

  it('caps the attributed files of one commit at 1000 and keeps the first ones', () => {
    const added = Array.from({ length: 1000 }, (_, index) => `a-${index}.ts`);
    const modified = Array.from({ length: 5 }, (_, index) => `m-${index}.ts`);

    const attributed = attributedFilesOf([
      commitOf(1, { added, modified }),
    ])?.[0];

    expect(attributed).toHaveLength(1000);
    expect(attributed?.[0]).toBe('a-0.ts');
    expect(attributed?.[999]).toBe('a-999.ts');
    expect(attributed).not.toContain('m-0.ts');
  });

  it('does not cap a commit of exactly 1000 files', () => {
    const added = Array.from({ length: 1000 }, (_, index) => `a-${index}.ts`);

    expect(attributedFilesOf([commitOf(1, { added })])?.[0]).toEqual(added);
  });

  it('still reports a path beyond the per-commit cap as changed', () => {
    const added = Array.from({ length: 1001 }, (_, index) => `a-${index}.ts`);

    const event = normalizePush(pushOf([commitOf(1, { added })]));

    expect(event?.changedFiles).toHaveLength(1001);
    expect(event?.commits[0].attributedFiles).toHaveLength(1000);
  });

  it('takes no file from an earlier commit when a later one touched it beyond the cap', () => {
    const added = [
      ...Array.from({ length: 1000 }, (_, index) => `a-${index}.ts`),
      'late.spec.ts',
    ];

    const attributed = attributedFilesOf([
      commitOf(1, { modified: ['late.spec.ts', 'early.spec.ts'] }),
      commitOf(2, { added }),
    ]);

    // late.spec.ts is the 1001st path of the second commit, so no stored commit
    // may claim it: the first commit's version of it would be stale.
    expect(attributed?.[0]).toEqual(['early.spec.ts']);
    expect(attributed?.[1]).toHaveLength(1000);
    expect(attributed?.[1]).not.toContain('late.spec.ts');
  });

  it('attributes no files when the last delivered commit is not the head, because the order is unverified', () => {
    const head = commitOf(3, { modified: ['c.spec.ts'] });

    const event = normalizePush(
      pushOf(
        [
          head,
          commitOf(2, { added: ['b.spec.ts'] }),
          commitOf(1, { added: ['a.spec.ts'] }),
        ],
        { after: sha(3), head_commit: head },
      ),
    );

    expect(event?.commits.map((entry) => entry.sha)).toEqual([
      sha(3),
      sha(2),
      sha(1),
    ]);
    expect(event?.commits.map((entry) => entry.attributedFiles)).toEqual([
      [],
      [],
      [],
    ]);
    expect(event?.changedFiles).toEqual([
      'c.spec.ts',
      'b.spec.ts',
      'a.spec.ts',
    ]);
  });

  it('attributes no files when the head cannot be proven because after and head_commit carry no sha', () => {
    const event = normalizePush(
      pushOf([commitOf(1, { added: ['a.spec.ts'] })], {
        after: undefined,
        head_commit: { id: 'not-a-sha', added: ['h.spec.ts'] },
      }),
    );

    expect(event?.commits.map((entry) => entry.attributedFiles)).toEqual([[]]);
    expect(event?.changedFiles).toEqual(['a.spec.ts', 'h.spec.ts']);
  });

  it('does not let a repeated sha leave files attributed to the commits listed before it', () => {
    const attributed = attributedFilesOf([
      commitOf(1, { modified: ['a.spec.ts', 'x.spec.ts'] }),
      commitOf(2, { modified: ['a.spec.ts'] }),
      commitOf(1, { modified: ['a.spec.ts'] }),
      commitOf(3, { modified: ['z.spec.ts'] }),
    ]);

    // The repeated entry is not stored, so a.spec.ts has no recorded last commit.
    expect(attributed).toEqual([['x.spec.ts'], [], ['z.spec.ts']]);
  });
});

describe('GithubAdapter.normalize commits without a valid id', () => {
  const invalid = (extra: CommitFixture) => ({ id: 'abc123', ...extra });

  it('keeps the files of a delivered commit whose id is not a 40-hex sha in the net changed files', () => {
    const event = normalizePush(
      pushOf([
        commitOf(1, { added: ['a.spec.ts'] }),
        invalid({ added: ['orphan.spec.ts'], modified: ['b.spec.ts'] }),
        commitOf(3, { modified: ['c.spec.ts'] }),
      ]),
    );

    expect(event?.changedFiles).toEqual([
      'a.spec.ts',
      'orphan.spec.ts',
      'b.spec.ts',
      'c.spec.ts',
    ]);
  });

  it('keeps the files of a commit with a missing, numeric or non-hex id', () => {
    expect(
      changedFilesOf([
        { added: ['no-id.spec.ts'] },
        { id: 12345, added: ['numeric.spec.ts'] },
        { id: 'g'.repeat(40), added: ['non-hex.spec.ts'] },
        commitOf(4, { added: ['ok.spec.ts'] }),
      ]),
    ).toEqual([
      'no-id.spec.ts',
      'numeric.spec.ts',
      'non-hex.spec.ts',
      'ok.spec.ts',
    ]);
  });

  it('replays the removals of such a commit in the delivered order', () => {
    expect(
      changedFilesOf([
        commitOf(1, { added: ['tmp.spec.ts', 'keep.spec.ts'] }),
        invalid({ removed: ['tmp.spec.ts'] }),
        commitOf(3, { modified: ['other.spec.ts'] }),
      ]),
    ).toEqual(['keep.spec.ts', 'other.spec.ts']);
  });

  it('does not store the commit itself', () => {
    const event = normalizePush(
      pushOf([
        commitOf(1, { added: ['a.spec.ts'] }),
        invalid({ added: ['orphan.spec.ts'] }),
        commitOf(3),
      ]),
    );

    expect(event?.commits.map((entry) => entry.sha)).toEqual([sha(1), sha(3)]);
    expect(event?.commits.map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('keeps a stored commit from claiming a file the unstored commit changed after it', () => {
    const attributed = attributedFilesOf([
      commitOf(1, { modified: ['shared.spec.ts', 'early.spec.ts'] }),
      invalid({ modified: ['shared.spec.ts'] }),
      commitOf(3, { modified: ['late.spec.ts', 'shared.spec.ts'] }),
    ]);

    // The unstored commit sits between the two stored ones: it does not take
    // shared.spec.ts away from the later stored commit, only from the earlier.
    expect(attributed).toEqual([
      ['early.spec.ts'],
      ['late.spec.ts', 'shared.spec.ts'],
    ]);
  });

  it('keeps the files of a last delivered commit without a valid id and treats the order as unverified', () => {
    const event = normalizePush(
      pushOf(
        [
          commitOf(1, { added: ['a.spec.ts'] }),
          invalid({ added: ['orphan.spec.ts'] }),
        ],
        {
          after: sha(9),
          head_commit: commitOf(9, { modified: ['head.spec.ts'] }),
        },
      ),
    );

    expect(event?.commitSha).toBe(sha(9));
    expect(event?.changedFiles).toEqual([
      'a.spec.ts',
      'orphan.spec.ts',
      'head.spec.ts',
    ]);
    expect(event?.commits.map((entry) => entry.attributedFiles)).toEqual([[]]);
  });

  it('does not take an earlier valid commit for the head when the last delivered one has no valid id', () => {
    const event = normalizePush(
      pushOf(
        [
          commitOf(1, { added: ['a.spec.ts'] }),
          invalid({ removed: ['a.spec.ts'] }),
        ],
        { after: sha(1), head_commit: commitOf(1, { added: ['a.spec.ts'] }) },
      ),
    );

    // The removal is not replayed because the last entry is not provably the
    // head, so the union minus the head removals applies.
    expect(event?.changedFiles).toEqual(['a.spec.ts']);
  });
});

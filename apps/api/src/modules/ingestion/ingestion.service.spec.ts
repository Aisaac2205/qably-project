import { createHmac } from 'node:crypto';
import { buildJobId } from '../../common/queue/job-id';
import { BitbucketAdapter } from './adapters/bitbucket.adapter';
import { GithubAdapter } from './adapters/github.adapter';
import { IngestionService } from './ingestion.service';

const secret = 'connection-secret';

const pushPayload = {
  ref: 'refs/heads/main',
  repository: { full_name: 'acme/shop', default_branch: 'main' },
  pusher: { name: 'ada' },
  head_commit: {
    id: 'a'.repeat(40),
    message: 'Add checkout guard',
    url: 'https://github.com/acme/shop/commit/aaa',
    added: ['src/cart.spec.ts'],
    modified: ['src/cart.ts'],
  },
};

const rawBody = JSON.stringify(pushPayload);

function githubHeaders(body = rawBody, signingSecret = secret) {
  return {
    'x-github-event': 'push',
    'x-github-delivery': 'delivery-1',
    'x-hub-signature-256': `sha256=${createHmac('sha256', signingSecret).update(body).digest('hex')}`,
  };
}

const connectionRow = {
  id: 'connection-1',
  organizationId: 'org-1',
  encryptedWebhookSecret: `enc(${secret})`,
};

interface FakePrisma {
  connection: { findMany: jest.Mock };
  scmEvent: { create: jest.Mock; findUnique: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    connection: { findMany: jest.fn().mockResolvedValue([connectionRow]) },
    scmEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'event-1', status: 'PROCESSED' }),
    },
  };
}

function createEncryption() {
  return {
    encrypt: jest.fn((value: string) => `enc(${value})`),
    decrypt: jest.fn((packed: string) => packed.slice(4, -1)),
    generateSecret: jest.fn(),
  };
}

function createQueue() {
  return {
    add: jest.fn(
      (_name: string, _data: unknown, options?: { jobId?: string }) => {
        if (options?.jobId?.includes(':') === true) {
          throw new Error('Custom Id cannot contain :');
        }

        return Promise.resolve({ id: 'job-1' });
      },
    ),
  };
}

function build(
  prisma: FakePrisma,
  encryption: ReturnType<typeof createEncryption>,
  queue: ReturnType<typeof createQueue>,
) {
  return new IngestionService(
    prisma as never,
    encryption as never,
    queue as never,
    [new GithubAdapter(), new BitbucketAdapter()],
  );
}

describe('IngestionService.ingest', () => {
  it('rejects a provider with no adapter', async () => {
    const prisma = createPrisma();
    const queue = createQueue();

    const result = await build(prisma, createEncryption(), queue).ingest(
      'gitlab',
      rawBody,
      githubHeaders(),
    );

    expect(result).toEqual({ ok: false, error: 'unknown-provider' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a body whose signature matches no connection secret', async () => {
    const prisma = createPrisma();
    const queue = createQueue();

    const result = await build(prisma, createEncryption(), queue).ingest(
      'github',
      rawBody,
      githubHeaders(rawBody, 'attacker-secret'),
    );

    expect(result).toEqual({ ok: false, error: 'unverified' });
    expect(prisma.scmEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a body that is not valid json', async () => {
    const prisma = createPrisma();
    const queue = createQueue();

    const result = await build(prisma, createEncryption(), queue).ingest(
      'github',
      'not-json',
      githubHeaders('not-json'),
    );

    expect(result).toEqual({ ok: false, error: 'invalid-payload' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('ignores an event type no adapter handles without persisting it', async () => {
    const prisma = createPrisma();
    const queue = createQueue();

    const result = await build(prisma, createEncryption(), queue).ingest(
      'github',
      rawBody,
      { ...githubHeaders(), 'x-github-event': 'star' },
    );

    expect(result).toEqual({ ok: true, value: 'ignored' });
    expect(prisma.scmEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('only considers connections for the repository named in the payload', async () => {
    const prisma = createPrisma();

    await build(prisma, createEncryption(), createQueue()).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(prisma.connection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'GITHUB', repo: 'acme/shop' },
      }),
    );
  });

  it('persists a verified event against its connection and organization', async () => {
    const prisma = createPrisma();

    const result = await build(
      prisma,
      createEncryption(),
      createQueue(),
    ).ingest('github', rawBody, githubHeaders());

    expect(result).toEqual({ ok: true, value: 'accepted' });

    const [call] = prisma.scmEvent.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toEqual({
      connectionId: 'connection-1',
      organizationId: 'org-1',
      provider: 'GITHUB',
      eventId: 'delivery-1',
      kind: 'PUSH',
      repo: 'acme/shop',
      branch: 'main',
      defaultBranch: 'main',
      commitSha: 'a'.repeat(40),
      author: 'ada',
      title: 'Add checkout guard',
      url: 'https://github.com/acme/shop/commit/aaa',
      changedFiles: ['src/cart.spec.ts', 'src/cart.ts'],
      beforeSha: null,
      forced: false,
      commitsTruncated: false,
      commits: { create: [] },
    });
  });

  describe('default branch column', () => {
    async function storedBranches(
      payload: Record<string, unknown>,
    ): Promise<{ branch: unknown; defaultBranch: unknown }> {
      const prisma = createPrisma();
      const body = JSON.stringify(payload);

      await build(prisma, createEncryption(), createQueue()).ingest(
        'github',
        body,
        githubHeaders(body),
      );

      const [call] = prisma.scmEvent.create.mock.calls as [
        [{ data: { branch: unknown; defaultBranch: unknown } }],
      ];

      const { branch, defaultBranch } = call[0].data;

      return { branch, defaultBranch };
    }

    it('stores the default branch next to the pushed branch', async () => {
      const stored = await storedBranches({
        ...pushPayload,
        ref: 'refs/heads/feat/cart',
      });

      expect(stored).toEqual({ branch: 'feat/cart', defaultBranch: 'main' });
    });

    it('stores null when the payload does not name a default branch', async () => {
      const stored = await storedBranches({
        ...pushPayload,
        repository: { full_name: 'acme/shop' },
      });

      expect(stored.defaultBranch).toBeNull();
    });
  });

  it('stores the commits of a push in the same create as the event', async () => {
    const prisma = createPrisma();
    const body = JSON.stringify({
      ...pushPayload,
      before: 'b'.repeat(40),
      forced: true,
      commits: [
        {
          id: 'c'.repeat(40),
          message: 'feat: add cart\n\nbody',
          author: { username: 'ada', name: 'Ada Lovelace' },
          timestamp: '2026-03-01T10:00:00+02:00',
          url: 'https://github.com/acme/shop/commit/ccc',
          added: ['src/cart.spec.ts'],
          modified: ['src/cart.ts'],
          removed: ['src/legacy.ts'],
        },
        {
          id: 'a'.repeat(40),
          message: 'Add checkout guard',
          modified: ['src/cart.ts'],
        },
      ],
    });

    const result = await build(
      prisma,
      createEncryption(),
      createQueue(),
    ).ingest('github', body, githubHeaders(body));

    expect(result).toEqual({ ok: true, value: 'accepted' });
    expect(prisma.scmEvent.create).toHaveBeenCalledTimes(1);

    const [call] = prisma.scmEvent.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toEqual(
      expect.objectContaining({
        beforeSha: 'b'.repeat(40),
        forced: true,
        commitsTruncated: false,
        commits: {
          create: [
            {
              sha: 'c'.repeat(40),
              position: 0,
              message: 'feat: add cart',
              author: 'ada',
              committedAt: new Date('2026-03-01T08:00:00.000Z'),
              url: 'https://github.com/acme/shop/commit/ccc',
              attributedFiles: [
                'src/cart.spec.ts',
                'src/cart.ts',
                'src/legacy.ts',
              ],
            },
            {
              sha: 'a'.repeat(40),
              position: 1,
              message: 'Add checkout guard',
              author: 'unknown',
              committedAt: null,
              url: null,
              attributedFiles: ['src/cart.ts'],
            },
          ],
        },
      }),
    );
  });

  it('flags the stored event when the commit list was cut short', async () => {
    const prisma = createPrisma();
    const commits = Array.from({ length: 251 }, (_, index) => ({
      id: index.toString(16).padStart(40, '0'),
      message: `commit ${index}`,
    }));
    const body = JSON.stringify({
      ...pushPayload,
      head_commit: { ...commits[250] },
      commits,
    });

    await build(prisma, createEncryption(), createQueue()).ingest(
      'github',
      body,
      githubHeaders(body),
    );

    const [call] = prisma.scmEvent.create.mock.calls as [
      [{ data: { commitsTruncated: boolean; commits: { create: unknown[] } } }],
    ];
    expect(call[0].data.commitsTruncated).toBe(true);
    expect(call[0].data.commits.create).toHaveLength(250);
  });

  it('never sends the same sha twice, so a unique violation always means a replayed event', async () => {
    const prisma = createPrisma();
    const body = JSON.stringify({
      ...pushPayload,
      commits: [
        { id: 'c'.repeat(40), message: 'first' },
        { id: 'a'.repeat(40), message: 'second' },
        { id: 'c'.repeat(40), message: 'first again' },
      ],
    });

    await build(prisma, createEncryption(), createQueue()).ingest(
      'github',
      body,
      githubHeaders(body),
    );

    const [call] = prisma.scmEvent.create.mock.calls as [
      [{ data: { commits: { create: { sha: string; message: string }[] } } }],
    ];
    expect(
      call[0].data.commits.create.map(({ sha, message }) => [sha, message]),
    ).toEqual([
      ['c'.repeat(40), 'first'],
      ['a'.repeat(40), 'second'],
    ]);
  });

  it('stores no commit time for an adapter timestamp that is not a date', async () => {
    const prisma = createPrisma();
    const adapter = {
      provider: 'GITHUB' as const,
      verifySignature: () => true,
      normalize: () => ({
        eventId: 'delivery-x',
        provider: 'GITHUB' as const,
        kind: 'push' as const,
        repo: 'acme/shop',
        branch: 'main',
        defaultBranch: null,
        commitSha: 'a'.repeat(40),
        author: 'ada',
        title: 'Add checkout guard',
        url: 'https://github.com/acme/shop/commit/aaa',
        changedFiles: [],
        beforeSha: null,
        forced: false,
        commitsTruncated: false,
        commits: [
          {
            sha: 'a'.repeat(40),
            position: 0,
            message: 'Add checkout guard',
            author: 'ada',
            committedAt: 'not-a-date',
            url: null,
            attributedFiles: [],
          },
        ],
      }),
    };

    const result = await new IngestionService(
      prisma as never,
      createEncryption() as never,
      createQueue() as never,
      [adapter],
    ).ingest('github', rawBody, {});

    expect(result).toEqual({ ok: true, value: 'accepted' });

    const [call] = prisma.scmEvent.create.mock.calls as [
      [{ data: { commits: { create: { committedAt: Date | null }[] } } }],
    ];
    expect(call[0].data.commits.create[0].committedAt).toBeNull();
  });

  it('queues the stored event for processing', async () => {
    const prisma = createPrisma();
    const queue = createQueue();

    await build(prisma, createEncryption(), queue).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(queue.add).toHaveBeenCalledWith(
      'scm-event',
      { scmEventId: 'event-1' },
      expect.objectContaining({
        jobId: buildJobId('scm-event', ['GITHUB', 'delivery-1']),
      }),
    );
  });

  it('treats a replayed delivery of an already processed event as a duplicate', async () => {
    const prisma = createPrisma();
    const queue = createQueue();
    prisma.scmEvent.create.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma, createEncryption(), queue).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(result).toEqual({ ok: true, value: 'duplicate' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues a replayed delivery whose stored event was never handed to the queue', async () => {
    const prisma = createPrisma();
    const queue = createQueue();
    prisma.scmEvent.create.mockRejectedValue({ code: 'P2002' });
    prisma.scmEvent.findUnique.mockResolvedValue({
      id: 'orphan-1',
      status: 'PENDING',
    });

    const result = await build(prisma, createEncryption(), queue).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(result).toEqual({ ok: true, value: 'accepted' });
    expect(queue.add).toHaveBeenCalledWith(
      'scm-event',
      { scmEventId: 'orphan-1' },
      expect.objectContaining({
        jobId: buildJobId('scm-event', ['GITHUB', 'delivery-1']),
      }),
    );
  });

  it('reports a duplicate when the replayed event vanished before it could be read', async () => {
    const prisma = createPrisma();
    const queue = createQueue();
    prisma.scmEvent.create.mockRejectedValue({ code: 'P2002' });
    prisma.scmEvent.findUnique.mockResolvedValue(null);

    const result = await build(prisma, createEncryption(), queue).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(result).toEqual({ ok: true, value: 'duplicate' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not leave a stored event unqueued when the queue rejects the job', async () => {
    const prisma = createPrisma();
    const queue = createQueue();
    queue.add.mockRejectedValueOnce(new Error('redis unavailable'));

    const service = build(prisma, createEncryption(), queue);

    await expect(
      service.ingest('github', rawBody, githubHeaders()),
    ).rejects.toThrow('redis unavailable');

    prisma.scmEvent.create.mockRejectedValue({ code: 'P2002' });
    prisma.scmEvent.findUnique.mockResolvedValue({
      id: 'event-1',
      status: 'PENDING',
    });

    const replay = await service.ingest('github', rawBody, githubHeaders());

    expect(replay).toEqual({ ok: true, value: 'accepted' });
    expect(queue.add).toHaveBeenCalledTimes(2);
  });
});

describe('IngestionService.ingest with an unreadable connection secret', () => {
  it('answers unverified instead of throwing when the stored secret cannot be decrypted', async () => {
    const prisma = createPrisma();
    const queue = createQueue();
    const encryption = createEncryption();
    encryption.decrypt.mockImplementation(() => {
      throw new Error('Unsupported state or unable to authenticate data');
    });

    const result = await build(prisma, encryption, queue).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(result).toEqual({ ok: false, error: 'unverified' });
    expect(prisma.scmEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('still verifies a later candidate when an earlier one cannot be decrypted', async () => {
    const prisma = createPrisma();
    const queue = createQueue();
    const encryption = createEncryption();

    prisma.connection.findMany.mockResolvedValue([
      {
        id: 'connection-stale',
        organizationId: 'org-1',
        encryptedWebhookSecret: 'stale',
      },
      connectionRow,
    ]);
    encryption.decrypt.mockImplementation((packed: string) => {
      if (packed === 'stale') {
        throw new Error('Unsupported state or unable to authenticate data');
      }

      return packed.slice(4, -1);
    });

    const result = await build(prisma, encryption, queue).ingest(
      'github',
      rawBody,
      githubHeaders(),
    );

    expect(result).toEqual({ ok: true, value: 'accepted' });
    const [call] = prisma.scmEvent.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data.connectionId).toBe('connection-1');
  });
});

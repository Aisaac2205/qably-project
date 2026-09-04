import { createHmac } from 'node:crypto';
import { BitbucketAdapter } from './adapters/bitbucket.adapter';
import { GithubAdapter } from './adapters/github.adapter';
import { IngestionService } from './ingestion.service';

const secret = 'connection-secret';

const pushPayload = {
  ref: 'refs/heads/main',
  repository: { full_name: 'acme/shop' },
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
  scmEvent: { create: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    connection: { findMany: jest.fn().mockResolvedValue([connectionRow]) },
    scmEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
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
  return { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
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
      commitSha: 'a'.repeat(40),
      author: 'ada',
      title: 'Add checkout guard',
      url: 'https://github.com/acme/shop/commit/aaa',
      changedFiles: ['src/cart.spec.ts', 'src/cart.ts'],
    });
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
      expect.objectContaining({ jobId: 'GITHUB:delivery-1' }),
    );
  });

  it('treats a replayed delivery as a duplicate without queueing it twice', async () => {
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

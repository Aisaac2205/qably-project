import {
  MAX_SCANNED_EVENTS,
  RunAttributionService,
} from './run-attribution.service';

const ORG = 'org-1';
const PROJECT = 'project-1';
const CONNECTION = 'connection-1';

const sha = (char: string): string => char.repeat(40);
const A = sha('a');
const B = sha('b');
const C = sha('c');
const D = sha('d');

interface EventOptions {
  id: string;
  branch?: string;
  commitSha: string;
  beforeSha: string | null;
  receivedAt: string;
  commits: Array<{
    sha: string;
    message?: string;
    author?: string;
    committedAt?: Date | null;
    url?: string | null;
  }>;
  kind?: 'PUSH' | 'PULL_REQUEST';
  forced?: boolean;
  commitsTruncated?: boolean;
}

function scmEvent(options: EventOptions) {
  return {
    id: options.id,
    kind: options.kind ?? 'PUSH',
    branch: options.branch ?? 'main',
    commitSha: options.commitSha,
    beforeSha: options.beforeSha,
    forced: options.forced ?? false,
    commitsTruncated: options.commitsTruncated ?? false,
    receivedAt: new Date(options.receivedAt),
    commits: options.commits.map((commit, position) => ({
      sha: commit.sha,
      position,
      message: commit.message ?? `message of ${commit.sha.slice(0, 7)}`,
      author: commit.author ?? 'Ada',
      committedAt: commit.committedAt ?? null,
      url: commit.url ?? null,
    })),
  };
}

function build(
  options: {
    project?: { connectionId: string | null } | null;
    events?: ReturnType<typeof scmEvent>[];
  } = {},
) {
  const prisma = {
    project: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.project === undefined
            ? { connectionId: CONNECTION }
            : options.project,
        ),
    },
    scmEvent: {
      findMany: jest.fn().mockResolvedValue(options.events ?? []),
    },
  };

  return { service: new RunAttributionService(prisma as never), prisma };
}

describe('RunAttributionService.attribute', () => {
  it('answers no_repository_connected when the project has no connection, without reading events', async () => {
    const { service, prisma } = build({ project: { connectionId: null } });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [{ key: 'run-2', baseSha: A, headSha: B }],
    });

    expect(result.get('run-2')).toEqual({
      kind: 'unknown',
      reason: 'no_repository_connected',
    });
    expect(prisma.scmEvent.findMany).not.toHaveBeenCalled();
  });

  it('treats a project that is missing or belongs to another organization as having no connection', async () => {
    const { service, prisma } = build({ project: null });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: 'project-elsewhere',
      pairs: [{ key: 'run-2', baseSha: A, headSha: B }],
    });

    expect(result.get('run-2')).toEqual({
      kind: 'unknown',
      reason: 'no_repository_connected',
    });
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-elsewhere', organizationId: ORG },
      select: { connectionId: true },
    });
    expect(prisma.scmEvent.findMany).not.toHaveBeenCalled();
  });

  it('answers no_commit_reported without touching the database when a run reported no commit', async () => {
    const { service, prisma } = build();

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [
        { key: 'no-base', baseSha: null, headSha: B },
        { key: 'no-head', baseSha: A, headSha: null },
        { key: 'blank', baseSha: '  ', headSha: B },
      ],
    });

    for (const key of ['no-base', 'no-head', 'blank']) {
      expect(result.get(key)).toEqual({
        kind: 'unknown',
        reason: 'no_commit_reported',
      });
    }
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    expect(prisma.scmEvent.findMany).not.toHaveBeenCalled();
  });

  it('answers same_commit without touching the database, matching a short sha against a full one', async () => {
    const { service, prisma } = build();

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [
        { key: 'equal', baseSha: A, headSha: A.toUpperCase() },
        { key: 'prefix', baseSha: A.slice(0, 7), headSha: A },
      ],
    });

    expect(result.get('equal')).toEqual({ kind: 'same_commit', sha: A });
    expect(result.get('prefix')).toEqual({ kind: 'same_commit', sha: A });
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    expect(prisma.scmEvent.findMany).not.toHaveBeenCalled();
  });

  it('lists the commits of a range across two pushes, oldest first, with ISO dates and the push branch', async () => {
    const { service } = build({
      events: [
        scmEvent({
          id: 'push-3',
          branch: 'main',
          commitSha: C,
          beforeSha: B,
          receivedAt: '2026-01-03T00:00:00.000Z',
          commits: [
            {
              sha: C,
              message: 'third',
              author: 'Grace',
              committedAt: new Date('2026-01-03T09:30:00.000Z'),
              url: 'https://example.test/c',
            },
          ],
        }),
        scmEvent({
          id: 'push-2',
          branch: 'main',
          commitSha: B,
          beforeSha: A,
          receivedAt: '2026-01-02T00:00:00.000Z',
          commits: [
            {
              sha: B,
              message: 'second',
              author: 'Ada',
              committedAt: null,
              url: null,
            },
          ],
        }),
        scmEvent({
          id: 'push-1',
          branch: 'main',
          commitSha: A,
          beforeSha: null,
          receivedAt: '2026-01-01T00:00:00.000Z',
          commits: [{ sha: A }],
        }),
      ],
    });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [{ key: 'run-3', baseSha: A, headSha: C }],
    });

    expect(result.get('run-3')).toEqual({
      kind: 'range',
      baseSha: A,
      headSha: C,
      commits: [
        {
          sha: B,
          message: 'second',
          author: 'Ada',
          committedAt: null,
          url: null,
          branch: 'main',
        },
        {
          sha: C,
          message: 'third',
          author: 'Grace',
          committedAt: '2026-01-03T09:30:00.000Z',
          url: 'https://example.test/c',
          branch: 'main',
        },
      ],
    });
  });

  it('exposes only the attributed commit fields, not the position or the push id', async () => {
    const { service } = build({
      events: [
        scmEvent({
          id: 'push-2',
          commitSha: B,
          beforeSha: A,
          receivedAt: '2026-01-02T00:00:00.000Z',
          commits: [{ sha: B }],
        }),
        scmEvent({
          id: 'push-1',
          commitSha: A,
          beforeSha: null,
          receivedAt: '2026-01-01T00:00:00.000Z',
          commits: [{ sha: A }],
        }),
      ],
    });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [{ key: 'run-2', baseSha: A, headSha: B }],
    });

    const attribution = result.get('run-2');
    expect(attribution?.kind).toBe('range');
    if (attribution?.kind !== 'range') return;
    expect(Object.keys(attribution.commits[0]).sort()).toEqual([
      'author',
      'branch',
      'committedAt',
      'message',
      'sha',
      'url',
    ]);
  });

  it('reads the push events of the connection once, scoped to the organization, newest first and bounded', async () => {
    const { service, prisma } = build();

    await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [
        { key: 'run-2', baseSha: A, headSha: B },
        { key: 'run-3', baseSha: B, headSha: C },
        { key: 'run-4', baseSha: C, headSha: D },
      ],
    });

    expect(MAX_SCANNED_EVENTS).toBe(1000);
    expect(prisma.project.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: PROJECT, organizationId: ORG },
      select: { connectionId: true },
    });
    expect(prisma.scmEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.scmEvent.findMany).toHaveBeenCalledWith({
      where: { connectionId: CONNECTION, organizationId: ORG, kind: 'PUSH' },
      orderBy: { receivedAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        kind: true,
        branch: true,
        commitSha: true,
        beforeSha: true,
        forced: true,
        commitsTruncated: true,
        receivedAt: true,
        commits: {
          orderBy: { position: 'asc' },
          select: {
            sha: true,
            position: true,
            message: true,
            author: true,
            committedAt: true,
            url: true,
          },
        },
      },
    });
  });

  it('maps many pairs by key, answering each from the same events', async () => {
    const { service } = build({
      events: [
        scmEvent({
          id: 'push-3',
          commitSha: C,
          beforeSha: B,
          receivedAt: '2026-01-03T00:00:00.000Z',
          commits: [{ sha: C }],
        }),
        scmEvent({
          id: 'push-2',
          commitSha: B,
          beforeSha: A,
          receivedAt: '2026-01-02T00:00:00.000Z',
          commits: [{ sha: B }],
        }),
        scmEvent({
          id: 'push-1',
          commitSha: A,
          beforeSha: null,
          receivedAt: '2026-01-01T00:00:00.000Z',
          commits: [{ sha: A }],
        }),
      ],
    });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [
        { key: 'short', baseSha: B, headSha: C },
        { key: 'long', baseSha: A, headSha: C },
        { key: 'same', baseSha: C, headSha: C },
        { key: 'missing', baseSha: null, headSha: C },
        { key: 'unknown-head', baseSha: A, headSha: D },
      ],
    });

    expect([...result.keys()].sort()).toEqual([
      'long',
      'missing',
      'same',
      'short',
      'unknown-head',
    ]);
    expect(result.get('short')).toMatchObject({
      kind: 'range',
      baseSha: B,
      headSha: C,
    });
    expect(result.get('long')).toMatchObject({
      kind: 'range',
      commits: [{ sha: B }, { sha: C }],
    });
    expect(result.get('same')).toEqual({ kind: 'same_commit', sha: C });
    expect(result.get('missing')).toEqual({
      kind: 'unknown',
      reason: 'no_commit_reported',
    });
    expect(result.get('unknown-head')).toEqual({
      kind: 'unknown',
      reason: 'commit_not_in_history',
    });
  });

  it('never lets a pull request event contribute to a range', async () => {
    const { service } = build({
      events: [
        scmEvent({
          id: 'pr-1',
          kind: 'PULL_REQUEST',
          commitSha: B,
          beforeSha: A,
          receivedAt: '2026-01-02T00:00:00.000Z',
          commits: [{ sha: B }],
        }),
        scmEvent({
          id: 'push-1',
          commitSha: A,
          beforeSha: null,
          receivedAt: '2026-01-01T00:00:00.000Z',
          commits: [{ sha: A }],
        }),
      ],
    });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [{ key: 'run-2', baseSha: A, headSha: B }],
    });

    expect(result.get('run-2')).toEqual({
      kind: 'unknown',
      reason: 'commit_not_in_history',
    });
  });

  it('ends a chain that needs events beyond the scanned window as history_gap', async () => {
    const { service } = build({
      events: [
        scmEvent({
          id: 'push-3',
          commitSha: C,
          beforeSha: B,
          receivedAt: '2026-01-03T00:00:00.000Z',
          commits: [{ sha: C }],
        }),
        scmEvent({
          id: 'push-1',
          commitSha: A,
          beforeSha: null,
          receivedAt: '2026-01-01T00:00:00.000Z',
          commits: [{ sha: A }],
        }),
      ],
    });

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [{ key: 'run-3', baseSha: A, headSha: C }],
    });

    expect(result.get('run-3')).toEqual({
      kind: 'unknown',
      reason: 'history_gap',
    });
  });

  it('returns an empty map and reads nothing when there are no pairs', async () => {
    const { service, prisma } = build();

    const result = await service.attribute({
      organizationId: ORG,
      projectId: PROJECT,
      pairs: [],
    });

    expect(result.size).toBe(0);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    expect(prisma.scmEvent.findMany).not.toHaveBeenCalled();
  });

  it('lets a failing database read reject, so the caller decides how to degrade', async () => {
    const { service, prisma } = build();
    prisma.scmEvent.findMany.mockRejectedValue(new Error('connection lost'));

    await expect(
      service.attribute({
        organizationId: ORG,
        projectId: PROJECT,
        pairs: [{ key: 'run-2', baseSha: A, headSha: B }],
      }),
    ).rejects.toThrow('connection lost');
  });
});

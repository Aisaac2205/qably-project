import { Prisma } from '../../../generated/prisma/client';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ChannelsService } from './channels.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const NOW = new Date('2026-06-16T11:00:00.000Z');

interface FakePrisma {
  notificationWebhook: { findMany: jest.Mock };
  notificationPreference: { findMany: jest.Mock };
  notificationDelivery: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
}

function createPrisma(): FakePrisma {
  return {
    notificationWebhook: { findMany: jest.fn().mockResolvedValue([]) },
    notificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
    notificationDelivery: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

interface FakeDeliveryRow {
  organizationId: string;
  webhookId: string | null;
  channel: 'slack' | 'discord' | 'email';
  userId?: string;
  eventType: string;
  status: 'sent' | 'failed';
  deliveredAt: Date;
}

type LastDeliveryWhereClause =
  | { webhookId: { in: string[] } }
  | { channel: 'email'; userId: string };

function findFirstRouter(rows: readonly FakeDeliveryRow[]) {
  return (args: {
    where: { organizationId: string; OR: LastDeliveryWhereClause[] };
  }) => {
    const matches = rows
      .filter((row) => {
        if (row.organizationId !== args.where.organizationId) return false;
        return args.where.OR.some((clause) =>
          'webhookId' in clause
            ? row.webhookId !== null &&
              clause.webhookId.in.includes(row.webhookId)
            : row.channel === 'email' && row.userId === clause.userId,
        );
      })
      .sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime());

    return Promise.resolve(matches[0] ?? null);
  };
}

function build(prisma: FakePrisma) {
  return new ChannelsService(prisma as never);
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ChannelsService organization scope', () => {
  it('scopes the webhook query to enabled webhooks in the caller organization', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', enabled: true },
      }),
    );
  });

  it('scopes the email preference query to the current user, organization and email channel', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', userId: 'user-1', channel: 'email' },
      }),
    );
  });

  it('skips the webhook delivery count raw query when there are no enabled webhooks, still issuing the always-on email and in-app queries', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    const calls = prisma.$queryRaw.mock.calls as [{ strings: string[] }][];
    const webhookDeliveryCalls = calls.filter(([sql]) =>
      sql.strings.join('').includes('d."webhookId"'),
    );
    expect(webhookDeliveryCalls).toHaveLength(0);
    expect(calls).toHaveLength(2);
  });

  it('scopes the delivery count raw query to the organization, the enabled webhook ids and the window bounds', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    const calls = prisma.$queryRaw.mock.calls as [
      { strings: string[]; values: unknown[] },
    ][];
    const [sql] = calls.find(([candidate]) =>
      candidate.strings.join('').includes('d."webhookId"'),
    ) as [{ strings: string[]; values: unknown[] }];
    const sqlText = sql.strings.join('');
    expect(sqlText).toContain('notification_delivery');
    expect(sqlText).toContain('<');
    expect(sql.values).toEqual(
      expect.arrayContaining(['org-1', 'webhook-1', NOW]),
    );
  });

  it("still issues the lastDelivery query when there are no enabled webhooks, scoped only to the current user's email deliveries", async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          OR: [{ channel: 'email', userId: 'user-1' }],
        },
      }),
    );
  });

  it('scopes the lastDelivery query to the organization, the enabled webhook ids and the current user email deliveries', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          OR: [
            { webhookId: { in: ['webhook-1'] } },
            { channel: 'email', userId: 'user-1' },
          ],
        },
      }),
    );
  });
});

describe('ChannelsService in-app channel scope', () => {
  it('always issues the in-app notification raw query, scoped to the organization, the current user and the window bounds', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    const calls = prisma.$queryRaw.mock.calls as [
      { strings: string[]; values: unknown[] },
    ][];
    const [sql] = calls.find(([candidate]) =>
      candidate.strings.join('').includes('FROM "notification" n'),
    ) as [{ strings: string[]; values: unknown[] }];
    const sqlText = sql.strings.join('');
    expect(sqlText).toContain('FROM "notification" n');
    expect(sqlText).toContain('<');
    expect(sql.values).toEqual(
      expect.arrayContaining(['org-1', 'user-1', NOW]),
    );
  });

  it('scopes the in-app query to a different user in the same call, never mixing user ids', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-2', 'UTC');

    const calls = prisma.$queryRaw.mock.calls as [
      { strings: string[]; values: unknown[] },
    ][];
    const [sql] = calls.find(([candidate]) =>
      candidate.strings.join('').includes('FROM "notification" n'),
    ) as [{ strings: string[]; values: unknown[] }];
    expect(sql.values).toContain('user-2');
    expect(sql.values).not.toContain('user-1');
  });

  it('reports zeroed in-app totals and a fully zero-filled daily window when there is no activity', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inApp.sent).toBe(0);
    expect(result.value.inApp.unread).toBe(0);
    expect(result.value.inApp.daily).toHaveLength(14);
    expect(
      result.value.inApp.daily.every(
        (point) => point.sent === 0 && point.failed === 0,
      ),
    ).toBe(true);
  });

  it('aggregates sent and unread counts from the raw query rows into the in-app totals', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockResolvedValue([
      { day: '2026-06-16', sent: 3, unread: 2 },
      { day: '2026-06-15', sent: 1, unread: 0 },
    ]);

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inApp.sent).toBe(4);
    expect(result.value.inApp.unread).toBe(2);
  });
});

describe('ChannelsService email channel', () => {
  it('scopes the email delivery count raw query to the organization, the current user, the email channel and the window bounds', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    const calls = prisma.$queryRaw.mock.calls as [
      { strings: string[]; values: unknown[] },
    ][];
    const [sql] = calls.find(([candidate]) =>
      candidate.strings.join('').includes(`d."channel" = 'email'`),
    ) as [{ strings: string[]; values: unknown[] }];
    const sqlText = sql.strings.join('');
    expect(sqlText).toContain('notification_delivery');
    expect(sqlText).toContain('<');
    expect(sql.values).toEqual(
      expect.arrayContaining(['org-1', 'user-1', NOW]),
    );
  });

  it('reports zeroed email totals and a fully zero-filled daily window when there are no email deliveries', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email.sent).toBe(0);
    expect(result.value.email.failed).toBe(0);
    expect(result.value.email.daily).toHaveLength(14);
  });

  it('aggregates sent and failed email delivery counts into the email totals and daily points', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockImplementation((sql: { strings: string[] }) => {
      const text = sql.strings.join('');
      if (text.includes(`d."channel" = 'email'`)) {
        return Promise.resolve([
          { day: '2026-06-16', status: 'sent', count: 3 },
          { day: '2026-06-16', status: 'failed', count: 1 },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email.sent).toBe(3);
    expect(result.value.email.failed).toBe(1);
    expect(
      result.value.email.daily.find((point) => point.date === '2026-06-16'),
    ).toEqual({ date: '2026-06-16', sent: 3, failed: 1 });
  });

  it("excludes another user's email deliveries from the current user's totals", async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-2', 'UTC');

    const calls = prisma.$queryRaw.mock.calls as [
      { strings: string[]; values: unknown[] },
    ][];
    const [sql] = calls.find(([candidate]) =>
      candidate.strings.join('').includes(`d."channel" = 'email'`),
    ) as [{ strings: string[]; values: unknown[] }];
    expect(sql.values).toContain('user-2');
    expect(sql.values).not.toContain('user-1');
  });
});

describe('ChannelsService lastDelivery resolution', () => {
  it('resolves lastDelivery to the full shape of the newest matching delivery', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);
    prisma.notificationDelivery.findFirst.mockImplementation(
      findFirstRouter([
        {
          organizationId: 'org-1',
          webhookId: 'webhook-1',
          channel: 'slack',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-16T09:00:00.000Z'),
        },
      ]),
    );

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lastDelivery).toEqual({
      webhookId: 'webhook-1',
      channel: 'slack',
      eventType: 'run_failed',
      status: 'sent',
      deliveredAt: '2026-06-16T09:00:00.000Z',
    });
  });

  it('resolves lastDelivery to the current user email delivery when it is the newest, labelled by channel and no webhookId', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);
    prisma.notificationDelivery.findFirst.mockImplementation(
      findFirstRouter([
        {
          organizationId: 'org-1',
          webhookId: 'webhook-1',
          channel: 'slack',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-15T09:00:00.000Z'),
        },
        {
          organizationId: 'org-1',
          webhookId: null,
          channel: 'email',
          userId: 'user-1',
          eventType: 'case_regressed',
          status: 'sent',
          deliveredAt: new Date('2026-06-16T09:00:00.000Z'),
        },
      ]),
    );

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lastDelivery).toEqual({
      webhookId: null,
      channel: 'email',
      eventType: 'case_regressed',
      status: 'sent',
      deliveredAt: '2026-06-16T09:00:00.000Z',
    });
  });

  it("ignores another user's email delivery even when it is newer", async () => {
    const prisma = createPrisma();
    prisma.notificationDelivery.findFirst.mockImplementation(
      findFirstRouter([
        {
          organizationId: 'org-1',
          webhookId: null,
          channel: 'email',
          userId: 'user-2',
          eventType: 'case_regressed',
          status: 'sent',
          deliveredAt: new Date('2026-06-16T09:00:00.000Z'),
        },
      ]),
    );

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lastDelivery).toBeNull();
  });

  it('ignores a newer delivery from a webhook that is not currently enabled', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);
    prisma.notificationDelivery.findFirst.mockImplementation(
      findFirstRouter([
        {
          organizationId: 'org-1',
          webhookId: 'webhook-1',
          channel: 'slack',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-15T09:00:00.000Z'),
        },
        {
          organizationId: 'org-1',
          webhookId: 'webhook-disabled',
          channel: 'slack',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-16T09:00:00.000Z'),
        },
      ]),
    );

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lastDelivery?.webhookId).toBe('webhook-1');
  });

  it('ignores a newer delivery belonging to another organization', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);
    prisma.notificationDelivery.findFirst.mockImplementation(
      findFirstRouter([
        {
          organizationId: 'org-1',
          webhookId: 'webhook-1',
          channel: 'slack',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-15T09:00:00.000Z'),
        },
        {
          organizationId: 'org-foreign',
          webhookId: 'webhook-1',
          channel: 'slack',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-16T09:00:00.000Z'),
        },
      ]),
    );

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lastDelivery?.deliveredAt).toBe(
      '2026-06-15T09:00:00.000Z',
    );
  });

  it('reports null lastDelivery when there are no enabled webhooks', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lastDelivery).toBeNull();
  });
});

describe('ChannelsService empty organization', () => {
  it('reports an empty webhook list, disabled email and null lastDelivery without crashing', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).channels(org, 'user-1', 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.webhooks).toEqual([]);
    expect(result.value.lastDelivery).toBeNull();
  });
});

describe('ChannelsService time zone errors', () => {
  it('maps an unknown-Postgres-zone rejection to invalid-time-zone', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);
    prisma.$queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Raw query failed. Code: `22023`.',
        {
          code: 'P2010',
          clientVersion: '7.0.0',
          meta: {
            code: '22023',
            message: 'invalid input syntax for type timestamp with time zone',
          },
        },
      ),
    );

    const result = await build(prisma).channels(
      org,
      'user-1',
      'America/Guatemala',
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('invalid-time-zone');
  });

  it('rethrows an unrelated database error', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);
    const dbError = new Error('connection reset');
    prisma.$queryRaw.mockRejectedValue(dbError);

    await expect(build(prisma).channels(org, 'user-1', 'UTC')).rejects.toBe(
      dbError,
    );
  });
});

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
  webhookId: string;
  eventType: string;
  status: 'sent' | 'failed';
  deliveredAt: Date;
}

function findFirstRouter(rows: readonly FakeDeliveryRow[]) {
  return (args: {
    where: { organizationId: string; webhookId: { in: string[] } };
  }) => {
    const matches = rows
      .filter(
        (row) =>
          row.organizationId === args.where.organizationId &&
          args.where.webhookId.in.includes(row.webhookId),
      )
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

  it('skips the delivery count raw query when there are no enabled webhooks', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('scopes the delivery count raw query to the organization, the enabled webhook ids and the window bounds', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [sql] = prisma.$queryRaw.mock.calls[0] as [
      { strings: string[]; values: unknown[] },
    ];
    const sqlText = sql.strings.join('');
    expect(sqlText).toContain('notification_delivery');
    expect(sqlText).toContain('<');
    expect(sql.values).toEqual(
      expect.arrayContaining(['org-1', 'webhook-1', NOW]),
    );
  });

  it('skips the lastDelivery query when there are no enabled webhooks', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
  });

  it('scopes the lastDelivery query to the organization and the enabled webhook ids', async () => {
    const prisma = createPrisma();
    prisma.notificationWebhook.findMany.mockResolvedValue([
      { id: 'webhook-1', type: 'slack', name: 'Team Slack', eventTypes: [] },
    ]);

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', webhookId: { in: ['webhook-1'] } },
      }),
    );
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
      eventType: 'run_failed',
      status: 'sent',
      deliveredAt: '2026-06-16T09:00:00.000Z',
    });
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
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-15T09:00:00.000Z'),
        },
        {
          organizationId: 'org-1',
          webhookId: 'webhook-disabled',
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
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-15T09:00:00.000Z'),
        },
        {
          organizationId: 'org-foreign',
          webhookId: 'webhook-1',
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

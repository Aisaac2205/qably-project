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
  notificationDelivery: { aggregate: jest.Mock };
  $queryRaw: jest.Mock;
}

function createPrisma(): FakePrisma {
  return {
    notificationWebhook: { findMany: jest.fn().mockResolvedValue([]) },
    notificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
    notificationDelivery: {
      aggregate: jest.fn().mockResolvedValue({ _max: { deliveredAt: null } }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
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

  it('scopes the lastDelivery aggregate to the caller organization', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.notificationDelivery.aggregate).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      _max: { deliveredAt: true },
    });
  });

  it('skips the delivery count raw query when there are no enabled webhooks', async () => {
    const prisma = createPrisma();

    await build(prisma).channels(org, 'user-1', 'UTC');

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('scopes the delivery count raw query to the organization and the enabled webhook ids', async () => {
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
    expect(sql.values).toEqual(expect.arrayContaining(['org-1', 'webhook-1']));
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

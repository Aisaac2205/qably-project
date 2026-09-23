import type { OrgContext } from '../organizations/organizations.contracts';
import { NotificationsService } from './notifications.service';
import type { UpdatePreferencesInput } from './notifications.schemas';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const row = {
  id: 'notif-1',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'run_failed' as const,
  severity: 'high' as const,
  payload: { runName: 'Checkout regression' },
  dedupeKey: 'run_failed:run-1',
  projectId: 'project-1',
  runId: 'run-1',
  testCaseId: null,
  ingestionBatchId: null,
  connectionId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  readAt: null,
};

interface FakePrisma {
  notification: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  notificationPreference: { findMany: jest.Mock; upsert: jest.Mock };
  notificationDelivery: { findMany: jest.Mock };
  user: { update: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    notification: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificationPreference: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    notificationDelivery: { findMany: jest.fn().mockResolvedValue([]) },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
}

function build(prisma: FakePrisma) {
  return new NotificationsService(prisma as never);
}

describe('NotificationsService.list', () => {
  it('scopes notifications to the caller organization and user', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, 'user-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', userId: 'user-1' },
      }),
    );
  });

  it('fetches deliveries in a single batched query keyed by organization and dedupeKey, not one query per row', async () => {
    const prisma = createPrisma();
    prisma.notification.findMany.mockResolvedValue([
      row,
      { ...row, id: 'notif-2', dedupeKey: 'run_completed:run-2' },
    ]);

    await build(prisma).list(org, 'user-1');

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          dedupeKey: { in: ['run_failed:run-1', 'run_completed:run-2'] },
          channel: { in: ['slack', 'discord'] },
        },
      }),
    );
  });

  it("never leaks another recipient's personal email delivery into the shared webhook deliveries list", async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, 'user-1');

    const [args] = prisma.notificationDelivery.findMany.mock.calls[0] as [
      { where: { channel: { in: string[] } } },
    ];
    expect(args.where.channel.in).not.toContain('email');
  });

  it('skips the delivery query entirely when there are no notifications', async () => {
    const prisma = createPrisma();
    prisma.notification.findMany.mockResolvedValue([]);

    await build(prisma).list(org, 'user-1');

    expect(prisma.notificationDelivery.findMany).not.toHaveBeenCalled();
  });

  it('attaches each delivery to the notification sharing its dedupeKey', async () => {
    const prisma = createPrisma();
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { dedupeKey: 'run_failed:run-1', channel: 'slack', status: 'sent' },
      { dedupeKey: 'run_failed:run-1', channel: 'discord', status: 'failed' },
    ]);

    const [result] = await build(prisma).list(org, 'user-1');

    expect(result?.deliveries).toEqual([
      { channel: 'slack', status: 'sent' },
      { channel: 'discord', status: 'failed' },
    ]);
  });

  it('returns an empty deliveries array for a notification with no webhook attempt', async () => {
    const prisma = createPrisma();

    const [result] = await build(prisma).list(org, 'user-1');

    expect(result?.deliveries).toEqual([]);
  });
});

describe('NotificationsService.markRead', () => {
  it('returns not-found for a notification outside the caller scope', async () => {
    const prisma = createPrisma();
    prisma.notification.findFirst.mockResolvedValue(null);

    const result = await build(prisma).markRead(org, 'user-1', 'notif-x');

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks the notification read once', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).markRead(org, 'user-1', 'notif-1');

    expect(result.ok).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'notif-1' } }),
    );
  });
});

describe('NotificationsService.markAllRead', () => {
  it('only touches unread notifications in scope', async () => {
    const prisma = createPrisma();

    await build(prisma).markAllRead(org, 'user-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', userId: 'user-1', readAt: null },
      }),
    );
  });
});

describe('NotificationsService.getPreferences', () => {
  it('scopes preference rows to the caller organization and user', async () => {
    const prisma = createPrisma();

    await build(prisma).getPreferences(org, 'user-1');

    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', userId: 'user-1' },
      }),
    );
  });
});

describe('NotificationsService.updatePreferences', () => {
  const input: UpdatePreferencesInput = {
    preferences: [{ eventType: 'run_failed', channel: 'email', enabled: true }],
  };

  it('upserts every toggled preference row', async () => {
    const prisma = createPrisma();

    await build(prisma).updatePreferences(org, 'user-1', input);

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          eventType: 'run_failed',
          channel: 'email',
          enabled: true,
        }) as unknown,
        update: { enabled: true },
      }),
    );
  });

  it('does not touch the user row when no locale is given', async () => {
    const prisma = createPrisma();

    await build(prisma).updatePreferences(org, 'user-1', input);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('writes the locale when given', async () => {
    const prisma = createPrisma();

    await build(prisma).updatePreferences(org, 'user-1', {
      locale: 'es',
      preferences: [],
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { locale: 'es' },
    });
  });
});

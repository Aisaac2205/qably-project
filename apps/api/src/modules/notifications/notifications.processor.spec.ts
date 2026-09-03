import { NotificationsProcessor } from './notifications.processor';
import type { NotificationJobData } from './notifications.contracts';

const runFailedEvent: NotificationJobData = {
  eventType: 'run_failed',
  organizationId: 'org-1',
  severity: 'high',
  payload: { runName: 'Checkout regression', suiteName: 'Checkout' },
  dedupeKey: 'run_failed:run-1',
  runId: 'run-1',
};

const connectionSecurityEvent: NotificationJobData = {
  eventType: 'connection_security',
  organizationId: 'org-1',
  severity: 'critical',
  payload: { action: 'Created', connectionName: 'Primary' },
  dedupeKey: 'connection_security:connection-1:created',
  connectionId: 'connection-1',
};

const ownerMember = {
  userId: 'user-owner',
  role: 'owner' as const,
  user: { locale: 'en', email: 'owner@acme.test', name: 'Owner' },
};

const adminMember = {
  userId: 'user-admin',
  role: 'admin' as const,
  user: { locale: 'en', email: 'admin@acme.test', name: 'Admin' },
};

const memberMember = {
  userId: 'user-member',
  role: 'member' as const,
  user: { locale: 'es', email: 'member@acme.test', name: 'Member' },
};

interface FakePrisma {
  orgMember: { findMany: jest.Mock };
  notificationPreference: { findUnique: jest.Mock };
  notification: { upsert: jest.Mock };
}

function createPrisma(
  members = [ownerMember, adminMember, memberMember],
): FakePrisma {
  return {
    orgMember: { findMany: jest.fn().mockResolvedValue(members) },
    notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

function createMailer() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function build(prisma: FakePrisma, mailer: { send: jest.Mock }) {
  return new NotificationsProcessor(prisma as never, mailer as never);
}

function job(data: NotificationJobData) {
  return { data } as never;
}

describe('NotificationsProcessor recipient resolution', () => {
  it('notifies every org member for a non-security event', async () => {
    const prisma = createPrisma();
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.orgMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('restricts connection_security to owner and admin roles only', async () => {
    const prisma = createPrisma();
    const mailer = createMailer();

    await build(prisma, mailer).process(job(connectionSecurityEvent));

    expect(prisma.orgMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          role: { in: ['owner', 'admin'] },
        },
      }),
    );
  });
});

describe('NotificationsProcessor preference resolution', () => {
  it('uses the default preference when no row exists', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('lets an explicit preference row override the default', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockImplementation(
      ({
        where,
      }: {
        where: { userId_organizationId_eventType_channel: { channel: string } };
      }) =>
        Promise.resolve(
          where.userId_organizationId_eventType_channel.channel === 'email'
            ? { enabled: true }
            : null,
        ),
    );
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it('renders the email in the recipient locale', async () => {
    const prisma = createPrisma([memberMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    const [call] = mailer.send.mock.calls as [[{ html: string; to: string }]];
    expect(call[0].to).toBe('member@acme.test');
    expect(call[0].html).toContain('falló');
  });
});

describe('NotificationsProcessor dedupe upsert', () => {
  it('upserts on userId + organizationId + dedupeKey so a retried job does not duplicate the row', async () => {
    const prisma = createPrisma([ownerMember]);
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_organizationId_dedupeKey: {
            userId: 'user-owner',
            organizationId: 'org-1',
            dedupeKey: 'run_failed:run-1',
          },
        },
      }),
    );
  });

  it('scopes the unique constraint by organization so the same dedupeKey in two orgs never collides', async () => {
    const prisma = createPrisma([ownerMember]);
    const mailer = createMailer();
    const sameKeyOtherOrg: NotificationJobData = {
      ...runFailedEvent,
      organizationId: 'org-2',
    };

    await build(prisma, mailer).process(job(runFailedEvent));
    await build(prisma, mailer).process(job(sameKeyOtherOrg));

    const [firstCall, secondCall] = prisma.notification.upsert.mock
      .calls as [
      [{ where: { userId_organizationId_dedupeKey: { organizationId: string } } }],
      [{ where: { userId_organizationId_dedupeKey: { organizationId: string } } }],
    ];
    expect(firstCall[0].where.userId_organizationId_dedupeKey.organizationId).toBe(
      'org-1',
    );
    expect(secondCall[0].where.userId_organizationId_dedupeKey.organizationId).toBe(
      'org-2',
    );
  });
});

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
  notificationWebhook: { findMany: jest.Mock };
}

function createPrisma(
  members = [ownerMember, adminMember, memberMember],
): FakePrisma {
  return {
    orgMember: { findMany: jest.fn().mockResolvedValue(members) },
    notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { upsert: jest.fn().mockResolvedValue({}) },
    notificationWebhook: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function createMailer() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function createEncryption() {
  return {
    encrypt: jest.fn((plaintext: string) => `enc(${plaintext})`),
    decrypt: jest.fn((packed: string) =>
      packed.replace('enc(', '').replace(')', ''),
    ),
    generateSecret: jest.fn(),
  };
}

function createWebhookChannel() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function build(
  prisma: FakePrisma,
  mailer: { send: jest.Mock },
  encryption: ReturnType<typeof createEncryption> = createEncryption(),
  slack: ReturnType<typeof createWebhookChannel> = createWebhookChannel(),
  discord: ReturnType<typeof createWebhookChannel> = createWebhookChannel(),
) {
  return new NotificationsProcessor(
    prisma as never,
    mailer as never,
    encryption as never,
    slack,
    discord,
  );
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

    const [firstCall, secondCall] = prisma.notification.upsert.mock.calls as [
      [
        {
          where: {
            userId_organizationId_dedupeKey: { organizationId: string };
          };
        },
      ],
      [
        {
          where: {
            userId_organizationId_dedupeKey: { organizationId: string };
          };
        },
      ],
    ];
    expect(
      firstCall[0].where.userId_organizationId_dedupeKey.organizationId,
    ).toBe('org-1');
    expect(
      secondCall[0].where.userId_organizationId_dedupeKey.organizationId,
    ).toBe('org-2');
  });
});

describe('NotificationsProcessor team webhook fan-out', () => {
  it('never queries webhooks without scoping by the event organizationId', async () => {
    const prisma = createPrisma([]);
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.notificationWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }) as unknown,
      }),
    );
  });

  it('only fans out to enabled webhooks whose eventTypes include the event', async () => {
    const prisma = createPrisma([]);
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.notificationWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enabled: true,
          eventTypes: { has: 'run_failed' },
        }) as unknown,
      }),
    );
  });

  it('decrypts the stored url and posts through the slack channel for a slack webhook', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const mailer = createMailer();
    const slack = createWebhookChannel();
    const discord = createWebhookChannel();

    await build(prisma, mailer, createEncryption(), slack, discord).process(
      job(runFailedEvent),
    );

    expect(slack.send).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/x',
      expect.any(String),
    );
    expect(discord.send).not.toHaveBeenCalled();
  });

  it('posts through the discord channel for a discord webhook', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        encryptedUrl: 'enc(https://discord.com/api/webhooks/1/token)',
        type: 'discord',
      },
    ]);
    const mailer = createMailer();
    const slack = createWebhookChannel();
    const discord = createWebhookChannel();

    await build(prisma, mailer, createEncryption(), slack, discord).process(
      job(runFailedEvent),
    );

    expect(discord.send).toHaveBeenCalledTimes(1);
    expect(slack.send).not.toHaveBeenCalled();
  });

  it('never reaches org B webhooks for an event published for org A', async () => {
    const orgAPrisma = createPrisma([]);
    orgAPrisma.notificationWebhook.findMany.mockImplementation(
      ({ where }: { where: { organizationId: string } }) =>
        Promise.resolve(
          where.organizationId === 'org-1'
            ? [
                {
                  encryptedUrl: 'enc(https://hooks.slack.com/services/org-1)',
                  type: 'slack',
                },
              ]
            : [],
        ),
    );
    const mailer = createMailer();
    const slack = createWebhookChannel();
    const discord = createWebhookChannel();
    const orgBEvent: NotificationJobData = {
      ...runFailedEvent,
      organizationId: 'org-2',
      dedupeKey: 'run_failed:run-2',
      runId: 'run-2',
    };

    await build(orgAPrisma, mailer, createEncryption(), slack, discord).process(
      job(orgBEvent),
    );

    expect(slack.send).not.toHaveBeenCalled();
  });
});

import { NotificationsProcessor } from './notifications.processor';
import type { NotificationJobData } from './notifications.contracts';

const runFailedEvent: NotificationJobData = {
  eventType: 'run_failed',
  organizationId: 'org-1',
  severity: 'high',
  payload: { runName: 'Checkout regression', suiteName: 'Checkout' },
  dedupeKey: 'run_failed:run-1',
  projectId: 'project-1',
  runId: 'run-1',
};

const connectionSecurityEvent: NotificationJobData = {
  eventType: 'connection_security',
  organizationId: 'org-1',
  severity: 'critical',
  payload: { action: 'created', connectionName: 'Primary' },
  dedupeKey: 'connection_security:connection-1:created',
  connectionId: 'connection-1',
};

const legacyConnectionSecurityEvent: NotificationJobData = {
  ...connectionSecurityEvent,
  payload: { action: 'Created', connectionName: 'Primary' },
};

const proposalsReadyEvent: NotificationJobData = {
  eventType: 'proposals_ready',
  organizationId: 'org-1',
  severity: 'medium',
  payload: {
    source: 'push',
    count: 2,
    projectId: 'project-1',
    batchId: 'batch-1',
    commitSha: 'abc1234def',
    author: 'ada',
    branch: 'main',
  },
  dedupeKey: 'proposals:push:batch-1',
  projectId: 'project-1',
  ingestionBatchId: 'batch-1',
};

const singleProposalEvent: NotificationJobData = {
  eventType: 'proposals_ready',
  organizationId: 'org-1',
  severity: 'medium',
  payload: {
    source: 'chat',
    count: 1,
    projectId: 'project-1',
    batchId: 'proposal-9',
  },
  dedupeKey: 'proposals:chat:proposal-9',
  projectId: 'project-1',
};

interface FakeMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  user: { locale: string | null; email: string; name: string };
}

const ownerMember: FakeMember = {
  userId: 'user-owner',
  role: 'owner',
  user: { locale: 'en', email: 'owner@acme.test', name: 'Owner' },
};

const adminMember: FakeMember = {
  userId: 'user-admin',
  role: 'admin',
  user: { locale: 'en', email: 'admin@acme.test', name: 'Admin' },
};

const memberMember: FakeMember = {
  userId: 'user-member',
  role: 'member',
  user: { locale: 'es', email: 'member@acme.test', name: 'Member' },
};

interface FakePrisma {
  orgMember: { findMany: jest.Mock; findFirst: jest.Mock };
  notificationPreference: { findUnique: jest.Mock };
  notification: { upsert: jest.Mock };
  notificationWebhook: { findMany: jest.Mock };
  notificationDelivery: { findUnique: jest.Mock; upsert: jest.Mock };
  extractedProposal: { count: jest.Mock };
}

function createPrisma(
  members: FakeMember[] = [ownerMember, adminMember, memberMember],
): FakePrisma {
  const owner = members.find((member) => member.role === 'owner') ?? null;

  return {
    orgMember: {
      findMany: jest.fn().mockResolvedValue(members),
      findFirst: jest
        .fn()
        .mockResolvedValue(owner === null ? null : { user: owner.user }),
    },
    notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { upsert: jest.fn().mockResolvedValue({}) },
    notificationWebhook: { findMany: jest.fn().mockResolvedValue([]) },
    notificationDelivery: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    extractedProposal: { count: jest.fn().mockResolvedValue(0) },
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

function createEnv() {
  return { WEB_APP_URL: 'https://app.qably.dev' };
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
    createEnv() as never,
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

  it('falls back to the default locale when the recipient has none on record', async () => {
    const prisma = createPrisma([
      { ...memberMember, user: { ...memberMember.user, locale: null } },
    ]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    const [call] = mailer.send.mock.calls as [[{ html: string; to: string }]];
    expect(call[0].html).toContain('failed');
  });

  it('sends an event-specific subject instead of a generic one', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    const [call] = mailer.send.mock.calls as [[{ subject: string }]];
    expect(call[0].subject).toBe('Run "Checkout regression" failed');
  });

  it('links to the settings page for notification preferences', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    const [call] = mailer.send.mock.calls as [[{ html: string }]];
    expect(call[0].html).toContain('https://app.qably.dev/settings');
  });

  it('never leaks the English connection_security action into an es recipient email, even for a legacy English payload', async () => {
    const prisma = createPrisma([memberMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(legacyConnectionSecurityEvent));

    const [call] = mailer.send.mock.calls as [
      [{ html: string; subject: string }],
    ];
    expect(call[0].subject).not.toMatch(/created|rotated|removed/i);
    expect(call[0].html).not.toMatch(/created|rotated|removed/i);
    expect(call[0].subject).toBe('Se creó la conexión Primary');
    expect(call[0].html).toContain('Se creó la conexión Primary.');
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
  it('records a sent delivery row scoped by organization, event and dedupeKey', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-slack-record',
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith({
      where: {
        webhookId_dedupeKey: {
          webhookId: 'webhook-slack-record',
          dedupeKey: 'run_failed:run-1',
        },
      },
      create: {
        organizationId: 'org-1',
        eventType: 'run_failed',
        dedupeKey: 'run_failed:run-1',
        channel: 'slack',
        webhookId: 'webhook-slack-record',
        status: 'sent',
      },
      update: {
        status: 'sent',
        deliveredAt: expect.any(Date) as Date,
        errorMessage: null,
      },
    });
  });

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
        id: 'webhook-slack-1',
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
      expect.objectContaining({
        title: expect.any(String) as string,
        message: expect.any(String) as string,
        color: expect.any(String) as string,
        timestamp: expect.any(String) as string,
        url: 'https://app.qably.dev/projects/project-1/runs/run-1',
      }),
    );
    expect(discord.send).not.toHaveBeenCalled();
  });

  it("renders the webhook message in the organization owner's locale, since a webhook has no single recipient", async () => {
    const prisma = createPrisma([
      { ...ownerMember, user: { ...ownerMember.user, locale: 'es' } },
    ]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-slack-2',
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

    const [, notification] = slack.send.mock.calls[0] as [
      string,
      { message: string },
    ];
    expect(notification.message).toContain('falló');
  });

  it('posts through the discord channel for a discord webhook', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-discord-1',
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

  it('keeps delivering to other webhooks and does not fail the job when one webhook throws', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-discord-2',
        encryptedUrl: 'enc(https://discord.com/api/webhooks/1/token)',
        type: 'discord',
      },
      {
        id: 'webhook-slack-3',
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const mailer = createMailer();
    const slack = createWebhookChannel();
    const discord = createWebhookChannel();
    discord.send.mockRejectedValue(
      new Error('Discord webhook failed with status 500'),
    );

    await expect(
      build(prisma, mailer, createEncryption(), slack, discord).process(
        job(runFailedEvent),
      ),
    ).resolves.toBeUndefined();

    expect(discord.send).toHaveBeenCalledTimes(1);
    expect(slack.send).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          webhookId: 'webhook-discord-2',
          channel: 'discord',
          status: 'failed',
          errorMessage: 'Discord webhook failed with status 500',
        }) as unknown,
      }),
    );
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          webhookId: 'webhook-slack-3',
          channel: 'slack',
          status: 'sent',
        }) as unknown,
      }),
    );
  });

  it('does not re-send to a channel that already has a sent delivery for the same dedupeKey, since a BullMQ retry must not double-post', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-discord-retry',
        encryptedUrl: 'enc(https://discord.com/api/webhooks/1/token)',
        type: 'discord',
      },
    ]);
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      status: 'sent',
    });
    const mailer = createMailer();
    const discord = createWebhookChannel();

    await build(
      prisma,
      mailer,
      createEncryption(),
      createWebhookChannel(),
      discord,
    ).process(job(runFailedEvent));

    expect(discord.send).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled();
  });

  it('retries a channel whose prior delivery failed, since only a confirmed send should be skipped', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-discord-retry-2',
        encryptedUrl: 'enc(https://discord.com/api/webhooks/1/token)',
        type: 'discord',
      },
    ]);
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      status: 'failed',
    });
    const mailer = createMailer();
    const discord = createWebhookChannel();

    await build(
      prisma,
      mailer,
      createEncryption(),
      createWebhookChannel(),
      discord,
    ).process(job(runFailedEvent));

    expect(discord.send).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          webhookId_dedupeKey: {
            webhookId: 'webhook-discord-retry-2',
            dedupeKey: 'run_failed:run-1',
          },
        },
      }),
    );
  });

  it('omits the url when the event has no project/run to deep-link to', async () => {
    const prisma = createPrisma([]);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-slack-4',
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const mailer = createMailer();
    const slack = createWebhookChannel();
    const discord = createWebhookChannel();

    await build(prisma, mailer, createEncryption(), slack, discord).process(
      job(connectionSecurityEvent),
    );

    const [, notification] = slack.send.mock.calls[0] as [
      string,
      { url?: string },
    ];
    expect(notification.url).toBeUndefined();
  });

  it('never reaches org B webhooks for an event published for org A', async () => {
    const orgAPrisma = createPrisma([]);
    orgAPrisma.notificationWebhook.findMany.mockImplementation(
      ({ where }: { where: { organizationId: string } }) =>
        Promise.resolve(
          where.organizationId === 'org-1'
            ? [
                {
                  id: 'webhook-slack-org-1',
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

describe('NotificationsProcessor email delivery recording', () => {
  it('records a sent email delivery scoped by organization, user, event and dedupeKey', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith({
      where: {
        userId_dedupeKey_channel: {
          userId: 'user-owner',
          dedupeKey: 'run_failed:run-1',
          channel: 'email',
        },
      },
      create: {
        organizationId: 'org-1',
        eventType: 'run_failed',
        dedupeKey: 'run_failed:run-1',
        channel: 'email',
        userId: 'user-owner',
        status: 'sent',
      },
      update: {
        status: 'sent',
        deliveredAt: expect.any(Date) as Date,
        errorMessage: null,
      },
    });
  });

  it('records a failed email delivery and still rejects the job so BullMQ retries it', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();
    mailer.send.mockRejectedValue(new Error('SMTP timeout'));

    await expect(
      build(prisma, mailer).process(job(runFailedEvent)),
    ).rejects.toThrow('SMTP timeout');

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          channel: 'email',
          userId: 'user-owner',
          status: 'failed',
          errorMessage: 'SMTP timeout',
        }) as unknown,
      }),
    );
  });

  it('does not record an email delivery when the email channel is disabled for the recipient', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    expect(mailer.send).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled();
  });

  it('records one email delivery per recipient, never mixing user ids', async () => {
    const prisma = createPrisma([ownerMember, memberMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(runFailedEvent));

    const userIds = prisma.notificationDelivery.upsert.mock.calls.map(
      ([call]: [{ create: { userId: string } }]) => call.create.userId,
    );
    expect(userIds).toEqual(
      expect.arrayContaining(['user-owner', 'user-member']),
    );
    expect(new Set(userIds).size).toBe(2);
  });
});

interface UpsertArgs {
  where: {
    userId_organizationId_dedupeKey: { userId: string; dedupeKey: string };
  };
  create: { payload: Record<string, unknown>; ingestionBatchId?: string };
  update: { payload?: Record<string, unknown>; readAt?: unknown };
}

function upsertCalls(prisma: FakePrisma): UpsertArgs[] {
  return (prisma.notification.upsert.mock.calls as [UpsertArgs][]).map(
    ([call]) => call,
  );
}

describe('NotificationsProcessor proposals_ready batches', () => {
  it('recounts the in-review proposals of the batch, scoped to the organization', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.extractedProposal.count.mockResolvedValue(18);

    await build(prisma, createMailer()).process(job(proposalsReadyEvent));

    expect(prisma.extractedProposal.count).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.count).toHaveBeenCalledWith({
      where: {
        status: 'in_review',
        project: { organizationId: 'org-1' },
        codeChange: { batchId: 'batch-1' },
      },
    });
  });

  it('writes the recounted number, not the number the job carried', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.extractedProposal.count.mockResolvedValue(18);

    await build(prisma, createMailer()).process(job(proposalsReadyEvent));

    const [call] = upsertCalls(prisma);
    expect(call.create.payload).toEqual({
      ...proposalsReadyEvent.payload,
      count: 18,
    });
    expect(call.create.ingestionBatchId).toBe('batch-1');
  });

  it('refreshes only the payload of an existing notification, so a read notification stays read', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.extractedProposal.count.mockResolvedValue(18);

    await build(prisma, createMailer()).process(job(proposalsReadyEvent));

    const [call] = upsertCalls(prisma);
    expect(call.where.userId_organizationId_dedupeKey).toEqual({
      userId: 'user-owner',
      organizationId: 'org-1',
      dedupeKey: 'proposals:push:batch-1',
    });
    expect(call.update).toEqual({
      payload: { ...proposalsReadyEvent.payload, count: 18 },
    });
    expect(call.update).not.toHaveProperty('readAt');
  });

  it('writes the same number when the same job runs again, so a retry never inflates the count', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.extractedProposal.count.mockResolvedValue(7);
    const processor = build(prisma, createMailer());

    await processor.process(job(proposalsReadyEvent));
    await processor.process(job(proposalsReadyEvent));

    const [first, second] = upsertCalls(prisma);
    expect(first.update).toEqual(second.update);
    expect(first.create.payload.count).toBe(7);
    expect(second.create.payload.count).toBe(7);
  });

  it('lets the last of several jobs of one batch settle on the full count', async () => {
    const prisma = createPrisma([ownerMember]);
    const processor = build(prisma, createMailer());

    prisma.extractedProposal.count.mockResolvedValueOnce(3);
    await processor.process(
      job({
        ...proposalsReadyEvent,
        payload: { ...proposalsReadyEvent.payload, count: 3 },
      }),
    );
    prisma.extractedProposal.count.mockResolvedValueOnce(18);
    await processor.process(
      job({
        ...proposalsReadyEvent,
        payload: { ...proposalsReadyEvent.payload, count: 15 },
      }),
    );

    const counts = upsertCalls(prisma).map(
      (call) => call.update.payload?.count as number,
    );
    expect(counts).toEqual([3, 18]);
    const keys = new Set(
      upsertCalls(prisma).map(
        (call) => call.where.userId_organizationId_dedupeKey.dedupeKey,
      ),
    );
    expect(keys.size).toBe(1);
  });

  it('notifies nobody when every proposal of the batch has already been decided', async () => {
    const prisma = createPrisma([ownerMember]);
    prisma.extractedProposal.count.mockResolvedValue(0);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-slack-empty',
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const slack = createWebhookChannel();

    await build(prisma, createMailer(), createEncryption(), slack).process(
      job(proposalsReadyEvent),
    );

    expect(prisma.notification.upsert).not.toHaveBeenCalled();
    expect(slack.send).not.toHaveBeenCalled();
  });

  it('does not recount a source that has no ingestion batch', async () => {
    const prisma = createPrisma([ownerMember]);

    await build(prisma, createMailer()).process(job(singleProposalEvent));

    expect(prisma.extractedProposal.count).not.toHaveBeenCalled();
    const [call] = upsertCalls(prisma);
    expect(call.create.payload).toEqual(singleProposalEvent.payload);
    expect(call.create).not.toHaveProperty('ingestionBatchId');
  });

  it('still refreshes the payload of a single-proposal notification on a repeat', async () => {
    const prisma = createPrisma([ownerMember]);

    await build(prisma, createMailer()).process(job(singleProposalEvent));

    const [call] = upsertCalls(prisma);
    expect(call.update).toEqual({ payload: singleProposalEvent.payload });
  });

  it('keeps the first-write-wins behaviour of every other event', async () => {
    const prisma = createPrisma([ownerMember]);

    await build(prisma, createMailer()).process(job(runFailedEvent));

    const [call] = upsertCalls(prisma);
    expect(call.update).toEqual({});
    expect(prisma.extractedProposal.count).not.toHaveBeenCalled();
  });

  it('renders the webhook message with the recounted number', async () => {
    const prisma = createPrisma([]);
    prisma.extractedProposal.count.mockResolvedValue(18);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-slack-count',
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const slack = createWebhookChannel();

    await build(prisma, createMailer(), createEncryption(), slack).process(
      job(proposalsReadyEvent),
    );

    const [, notification] = slack.send.mock.calls[0] as [
      string,
      { message: string },
    ];
    expect(notification.message).toBe('18 proposals are ready for review.');
  });
});

describe('NotificationsProcessor proposals_ready deep link', () => {
  async function webhookUrl(
    event: NotificationJobData,
  ): Promise<string | undefined> {
    const prisma = createPrisma([]);
    prisma.extractedProposal.count.mockResolvedValue(2);
    prisma.notificationWebhook.findMany.mockResolvedValue([
      {
        id: 'webhook-slack-link',
        encryptedUrl: 'enc(https://hooks.slack.com/services/x)',
        type: 'slack',
      },
    ]);
    const slack = createWebhookChannel();

    await build(prisma, createMailer(), createEncryption(), slack).process(
      job(event),
    );

    const [, notification] = slack.send.mock.calls[0] as [
      string,
      { url?: string },
    ];
    return notification.url;
  }

  it('links the webhook to the review inbox filtered by project and batch', async () => {
    await expect(webhookUrl(proposalsReadyEvent)).resolves.toBe(
      'https://app.qably.dev/review-inbox?projectId=project-1&batch=batch-1',
    );
  });

  it('links a single-proposal batch the same way', async () => {
    await expect(webhookUrl(singleProposalEvent)).resolves.toBe(
      'https://app.qably.dev/review-inbox?projectId=project-1&batch=proposal-9',
    );
  });

  it('encodes ids so a hostile batch id cannot add query parameters', async () => {
    const url = await webhookUrl({
      ...singleProposalEvent,
      payload: { ...singleProposalEvent.payload, batchId: 'a&status=all' },
    });

    expect(new URL(url as string).searchParams.get('batch')).toBe(
      'a&status=all',
    );
  });

  it('omits the url when the event carries no batch to link to', async () => {
    await expect(
      webhookUrl({
        ...singleProposalEvent,
        payload: { source: 'chat', count: 1, projectId: 'project-1' },
      }),
    ).resolves.toBeUndefined();
  });

  it('omits the url when the event carries no project to link to', async () => {
    await expect(
      webhookUrl({ ...singleProposalEvent, projectId: undefined }),
    ).resolves.toBeUndefined();
  });
});

describe('NotificationsProcessor email re-delivery', () => {
  function optedInPrisma(): FakePrisma {
    const prisma = createPrisma([ownerMember]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: true,
    });
    prisma.extractedProposal.count.mockResolvedValue(5);
    return prisma;
  }

  it('does not email a recipient again for a dedupeKey that was already emailed, since every job of one batch shares it', async () => {
    const prisma = optedInPrisma();
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      status: 'sent',
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(proposalsReadyEvent));

    expect(mailer.send).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_dedupeKey_channel: {
            userId: 'user-owner',
            dedupeKey: 'proposals:push:batch-1',
            channel: 'email',
          },
        },
      }),
    );
  });

  it('still refreshes the in-app notification when the email was already sent', async () => {
    const prisma = optedInPrisma();
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      status: 'sent',
    });

    await build(prisma, createMailer()).process(job(proposalsReadyEvent));

    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
  });

  it('retries an email whose earlier delivery failed', async () => {
    const prisma = optedInPrisma();
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      status: 'failed',
    });
    const mailer = createMailer();

    await build(prisma, mailer).process(job(proposalsReadyEvent));

    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it('emails a recipient that has no earlier delivery', async () => {
    const prisma = optedInPrisma();
    const mailer = createMailer();

    await build(prisma, mailer).process(job(proposalsReadyEvent));

    expect(mailer.send).toHaveBeenCalledTimes(1);
    const [call] = mailer.send.mock.calls as [[{ subject: string }]];
    expect(call[0].subject).toBe('5 proposals ready for review');
  });
});

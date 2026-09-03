import { isErr } from '../../../common/result';
import type { OrgContext } from '../../organizations/organizations.contracts';
import { NotificationWebhooksService } from './webhooks.service';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const admin: OrgContext = { ...owner, role: 'admin' };
const member: OrgContext = { ...owner, role: 'member' };

const row = {
  id: 'webhook-1',
  organizationId: 'org-1',
  type: 'slack' as const,
  name: 'Team alerts',
  encryptedUrl: 'iv:tag:cipher',
  enabled: true,
  eventTypes: ['run_failed' as const],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

interface FakePrisma {
  notificationWebhook: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

function createPrisma(): FakePrisma {
  return {
    notificationWebhook: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function createEncryption() {
  return {
    encrypt: jest.fn((plaintext: string) => `enc(${plaintext})`),
    decrypt: jest.fn(
      () => 'https://hooks.slack.com/services/T00/B00/secrettoken',
    ),
    generateSecret: jest.fn(),
  };
}

function createChannel() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function build(
  prisma: FakePrisma,
  encryption: ReturnType<typeof createEncryption>,
  slack: ReturnType<typeof createChannel> = createChannel(),
  discord: ReturnType<typeof createChannel> = createChannel(),
) {
  return new NotificationWebhooksService(
    prisma as never,
    encryption as never,
    slack,
    discord,
  );
}

describe('NotificationWebhooksService.list', () => {
  it('only reads webhooks of the caller organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findMany.mockResolvedValue([row]);

    await build(prisma, encryption).list(owner);

    expect(prisma.notificationWebhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('never returns the encrypted or plaintext url, only a masked hint', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findMany.mockResolvedValue([row]);

    const [webhook] = await build(prisma, encryption).list(owner);

    expect(webhook).not.toHaveProperty('url');
    expect(webhook).not.toHaveProperty('encryptedUrl');
    expect(JSON.stringify(webhook)).not.toContain('secrettoken');
    expect(webhook.maskedUrl).toBe('hooks.slack.com/••••oken');
  });
});

describe('NotificationWebhooksService.create', () => {
  const input = {
    type: 'slack' as const,
    name: 'Team alerts',
    url: 'https://hooks.slack.com/services/T00/B00/token',
    eventTypes: ['run_failed' as const],
  };

  it('refuses a plain member before touching prisma', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).create(member, input);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.notificationWebhook.create).not.toHaveBeenCalled();
  });

  it('allows an admin to create a webhook and encrypts the url at rest', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.create.mockResolvedValue(row);

    const result = await build(prisma, encryption).create(admin, input);

    expect(result.ok).toBe(true);
    const [call] = prisma.notificationWebhook.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data.encryptedUrl).toBe(`enc(${input.url})`);
    expect(call[0].data).not.toHaveProperty('url');
  });

  it('never leaks the plaintext url in the returned view', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.create.mockResolvedValue(row);

    const result = await build(prisma, encryption).create(owner, input);

    expect(JSON.stringify(result)).not.toContain('secrettoken');
  });
});

describe('NotificationWebhooksService.update', () => {
  it('refuses a webhook that belongs to another organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findFirst.mockResolvedValue(null);

    const result = await build(prisma, encryption).update(owner, 'webhook-x', {
      enabled: false,
    });

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.notificationWebhook.update).not.toHaveBeenCalled();
  });

  it('refuses a plain member before it even looks the webhook up', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).update(member, 'webhook-1', {
      enabled: false,
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.notificationWebhook.findFirst).not.toHaveBeenCalled();
  });

  it('lets an owner disable a webhook in scope', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findFirst.mockResolvedValue(row);
    prisma.notificationWebhook.update.mockResolvedValue({
      ...row,
      enabled: false,
    });

    const result = await build(prisma, encryption).update(owner, 'webhook-1', {
      enabled: false,
    });

    expect(result.ok).toBe(true);
    expect(prisma.notificationWebhook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'webhook-1' },
        data: { enabled: false },
      }),
    );
  });
});

describe('NotificationWebhooksService.remove', () => {
  it('lets an owner delete a webhook in scope', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findFirst.mockResolvedValue(row);

    await expect(
      build(prisma, encryption).remove(owner, 'webhook-1'),
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(prisma.notificationWebhook.delete).toHaveBeenCalledWith({
      where: { id: 'webhook-1' },
    });
  });

  it('refuses a plain member before it even looks the webhook up', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).remove(member, 'webhook-1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.notificationWebhook.findFirst).not.toHaveBeenCalled();
  });

  it('reports not-found for a webhook outside the organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findFirst.mockResolvedValue(null);

    await expect(
      build(prisma, encryption).remove(owner, 'webhook-x'),
    ).resolves.toEqual({ ok: false, error: 'not-found' });
  });
});

describe('NotificationWebhooksService.test', () => {
  it('decrypts the url and sends a fixed test message through the matching channel', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    const slack = createChannel();
    const discord = createChannel();
    prisma.notificationWebhook.findFirst.mockResolvedValue(row);

    const result = await build(prisma, encryption, slack, discord).test(
      owner,
      'webhook-1',
    );

    expect(isErr(result)).toBe(false);
    expect(slack.send).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/secrettoken',
      expect.any(String),
    );
    expect(discord.send).not.toHaveBeenCalled();
  });

  it('routes a discord webhook through the discord channel', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    const slack = createChannel();
    const discord = createChannel();
    prisma.notificationWebhook.findFirst.mockResolvedValue({
      ...row,
      type: 'discord',
    });

    await build(prisma, encryption, slack, discord).test(owner, 'webhook-1');

    expect(discord.send).toHaveBeenCalledTimes(1);
    expect(slack.send).not.toHaveBeenCalled();
  });

  it('refuses a plain member', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    const slack = createChannel();

    const result = await build(prisma, encryption, slack).test(
      member,
      'webhook-1',
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(slack.send).not.toHaveBeenCalled();
  });

  it('reports not-found for a webhook outside the organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.notificationWebhook.findFirst.mockResolvedValue(null);

    const result = await build(prisma, encryption).test(owner, 'webhook-x');

    expect(result).toEqual({ ok: false, error: 'not-found' });
  });
});

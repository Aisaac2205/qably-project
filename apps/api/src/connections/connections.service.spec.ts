import { isErr } from '../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ConnectionsService } from './connections.service';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const admin: OrgContext = { ...owner, role: 'admin' };
const member: OrgContext = { ...owner, role: 'member' };

const row = {
  id: 'connection-1',
  organizationId: 'org-1',
  provider: 'GITHUB' as const,
  name: 'Primary',
  repo: 'acme/shop',
  encryptedToken: 'iv:tag:cipher',
  encryptedWebhookSecret: 'iv:tag:secret',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

interface FakePrisma {
  connection: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

function createPrisma(): FakePrisma {
  return {
    connection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

interface FakeEncryption {
  encrypt: jest.Mock;
  decrypt: jest.Mock;
  generateSecret: jest.Mock;
}

function createEncryption(): FakeEncryption {
  return {
    encrypt: jest.fn((plaintext: string) => `enc(${plaintext})`),
    decrypt: jest.fn((packed: string) => packed),
    generateSecret: jest.fn(() => 'generated-secret'),
  };
}

function build(prisma: FakePrisma, encryption: FakeEncryption) {
  return new ConnectionsService(prisma as never, encryption as never);
}

describe('ConnectionsService.list', () => {
  it('only reads connections of the caller organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findMany.mockResolvedValue([row]);

    await build(prisma, encryption).list(owner);

    expect(prisma.connection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('never includes the encrypted token in the returned view', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findMany.mockResolvedValue([row]);

    const [connection] = await build(prisma, encryption).list(owner);

    expect(connection).not.toHaveProperty('encryptedToken');
    expect(connection).not.toHaveProperty('token');
    expect(JSON.stringify(connection)).not.toContain('cipher');
  });
});

describe('ConnectionsService.create', () => {
  const input = {
    provider: 'GITHUB' as const,
    name: 'Primary',
    repo: 'acme/shop',
    token: 'ghp_super-secret',
  };

  it('encrypts the token before persisting it', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.create.mockResolvedValue(row);

    await build(prisma, encryption).create(owner, input);

    expect(encryption.encrypt).toHaveBeenCalledWith('ghp_super-secret');
    const [call] = prisma.connection.create.mock.calls as [
      [{ data: { encryptedToken: string; organizationId: string } }],
    ];
    expect(call[0].data.encryptedToken).toBe('enc(ghp_super-secret)');
    expect(call[0].data.organizationId).toBe('org-1');
  });

  it('never leaks the plaintext token in the returned view', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.create.mockResolvedValue(row);

    const result = await build(prisma, encryption).create(owner, input);

    expect(JSON.stringify(result)).not.toContain('ghp_super-secret');
  });

  it('refuses a plain member before touching prisma', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).create(member, input);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.connection.create).not.toHaveBeenCalled();
    expect(encryption.encrypt).not.toHaveBeenCalled();
  });

  it('allows an admin to create a connection', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.create.mockResolvedValue(row);

    const result = await build(prisma, encryption).create(admin, input);

    expect(result.ok).toBe(true);
  });

  it('reports a duplicate instead of leaking the database error', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.create.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma, encryption).create(owner, input);

    expect(result).toEqual({ ok: false, error: 'duplicate' });
  });

  it('lets any other database failure surface', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.create.mockRejectedValue(new Error('connection lost'));

    await expect(
      build(prisma, encryption).create(owner, input),
    ).rejects.toThrow('connection lost');
  });
});

describe('ConnectionsService.update', () => {
  it('refuses a connection that belongs to another organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findFirst.mockResolvedValue(null);

    const result = await build(prisma, encryption).update(
      owner,
      'connection-x',
      {
        name: 'New',
      },
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.connection.update).not.toHaveBeenCalled();
  });

  it('re-encrypts the token when rotating it', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findFirst.mockResolvedValue(row);
    prisma.connection.update.mockResolvedValue(row);

    await build(prisma, encryption).update(owner, 'connection-1', {
      token: 'ghp_rotated',
    });

    expect(encryption.encrypt).toHaveBeenCalledWith('ghp_rotated');
    const [call] = prisma.connection.update.mock.calls as [
      [{ data: { encryptedToken?: string } }],
    ];
    expect(call[0].data.encryptedToken).toBe('enc(ghp_rotated)');
  });

  it('leaves the stored token untouched when only the name changes', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findFirst.mockResolvedValue(row);
    prisma.connection.update.mockResolvedValue(row);

    await build(prisma, encryption).update(owner, 'connection-1', {
      name: 'Renamed',
    });

    expect(encryption.encrypt).not.toHaveBeenCalled();
    const [call] = prisma.connection.update.mock.calls as [
      [{ data: { encryptedToken?: string } }],
    ];
    expect(call[0].data.encryptedToken).toBeUndefined();
  });

  it('refuses a plain member before it even looks the connection up', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).update(
      member,
      'connection-1',
      {
        name: 'New',
      },
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.connection.findFirst).not.toHaveBeenCalled();
  });
});

describe('ConnectionsService.remove', () => {
  it('lets an owner delete a connection in scope', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findFirst.mockResolvedValue(row);

    await expect(
      build(prisma, encryption).remove(owner, 'connection-1'),
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(prisma.connection.delete).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
    });
  });

  it('refuses a plain member before it even looks the connection up', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).remove(
      member,
      'connection-1',
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.connection.findFirst).not.toHaveBeenCalled();
  });

  it('reports not-found for a connection outside the organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findFirst.mockResolvedValue(null);

    await expect(
      build(prisma, encryption).remove(owner, 'connection-x'),
    ).resolves.toEqual({ ok: false, error: 'not-found' });
  });
});

describe('ConnectionsService webhook secret', () => {
  it('stores a generated secret encrypted when creating a connection', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    encryption.generateSecret.mockReturnValue('s3cr3t');
    prisma.connection.create.mockResolvedValue(row);

    await build(prisma, encryption).create(owner, {
      provider: 'GITHUB',
      name: 'Primary',
      repo: 'acme/shop',
      token: 'ghp_live',
    });

    const [call] = prisma.connection.create.mock.calls as [
      [{ data: { encryptedWebhookSecret: string } }],
    ];
    expect(call[0].data.encryptedWebhookSecret).toBe('enc(s3cr3t)');
  });

  it('reveals the plaintext secret once in the create response', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    encryption.generateSecret.mockReturnValue('s3cr3t');
    prisma.connection.create.mockResolvedValue(row);

    const result = await build(prisma, encryption).create(owner, {
      provider: 'GITHUB',
      name: 'Primary',
      repo: 'acme/shop',
      token: 'ghp_live',
    });

    expect(isErr(result)).toBe(false);
    if (isErr(result)) return;
    expect(result.value.webhookSecret).toBe('s3cr3t');
  });

  it('never exposes the webhook secret when listing connections', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findMany.mockResolvedValue([row]);

    const [connection] = await build(prisma, encryption).list(owner);

    expect(JSON.stringify(connection)).not.toContain('webhookSecret');
  });

  it('replaces the stored secret when rotating', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    encryption.generateSecret.mockReturnValue('rotated');
    prisma.connection.findFirst.mockResolvedValue(row);
    prisma.connection.update.mockResolvedValue(row);

    await build(prisma, encryption).rotateWebhookSecret(owner, 'connection-1');

    expect(prisma.connection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'connection-1' },
        data: { encryptedWebhookSecret: 'enc(rotated)' },
      }),
    );
  });

  it('returns the new plaintext secret when rotating', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    encryption.generateSecret.mockReturnValue('rotated');
    prisma.connection.findFirst.mockResolvedValue(row);
    prisma.connection.update.mockResolvedValue(row);

    const result = await build(prisma, encryption).rotateWebhookSecret(
      owner,
      'connection-1',
    );

    expect(isErr(result)).toBe(false);
    if (isErr(result)) return;
    expect(result.value.webhookSecret).toBe('rotated');
  });

  it('refuses to rotate for a member', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();

    const result = await build(prisma, encryption).rotateWebhookSecret(
      member,
      'connection-1',
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.connection.update).not.toHaveBeenCalled();
  });

  it('refuses to rotate a connection of another organization', async () => {
    const prisma = createPrisma();
    const encryption = createEncryption();
    prisma.connection.findFirst.mockResolvedValue(null);

    const result = await build(prisma, encryption).rotateWebhookSecret(
      admin,
      'connection-1',
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.connection.update).not.toHaveBeenCalled();
  });
});

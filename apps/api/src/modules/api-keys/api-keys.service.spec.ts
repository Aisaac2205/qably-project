import { isErr, isOk } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ApiKeysService } from './api-keys.service';
import {
  generateApiKeyToken,
  hashApiKeySecret,
  parseApiKeyToken,
} from './lib/token';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const admin: OrgContext = { ...owner, role: 'admin' };
const member: OrgContext = { ...owner, role: 'member' };

const row = {
  id: 'key-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'CI/CD Pipeline',
  lookupId: 'a1b2c3d4e5f6',
  hashedSecret: hashApiKeySecret('secret'),
  lastFour: 'cafe',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null as Date | null,
  revokedAt: null as Date | null,
};

interface FakePrisma {
  apiKey: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  project: { findFirst: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    apiKey: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
  };
}

function build(prisma: FakePrisma) {
  return new ApiKeysService(prisma as never);
}

function createdData(prisma: FakePrisma): Record<string, string> {
  const [call] = prisma.apiKey.create.mock.calls as [
    [{ data: Record<string, string> }],
  ];

  return call[0].data;
}

describe('ApiKeysService.list', () => {
  it('only reads keys of the requested project inside the caller organization', async () => {
    const prisma = createPrisma();

    await build(prisma).list(owner, 'project-1');

    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-1', organizationId: 'org-1' },
      }),
    );
  });

  it('refuses a project that belongs to another organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await build(prisma).list(owner, 'foreign-project');

    expect(isErr(result) && result.error).toBe('not-found');
    expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('never exposes the stored hash in the returned view', async () => {
    const prisma = createPrisma();
    prisma.apiKey.findMany.mockResolvedValue([row]);

    const result = await build(prisma).list(owner, 'project-1');

    expect(JSON.stringify(result)).not.toContain(row.hashedSecret);
  });
});

describe('ApiKeysService.create', () => {
  it('returns the plaintext token exactly once, on creation', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).create(owner, 'project-1', {
      name: 'CI/CD Pipeline',
    });

    expect(isOk(result) && parseApiKeyToken(result.value.token)).not.toBeNull();
  });

  it('stores the hash of the secret and never the secret itself', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).create(owner, 'project-1', {
      name: 'CI/CD Pipeline',
    });

    if (!isOk(result)) throw new Error('expected creation to succeed');

    const parsed = parseApiKeyToken(result.value.token);
    const data = createdData(prisma);

    expect(parsed).not.toBeNull();
    expect(data.hashedSecret).toBe(hashApiKeySecret(parsed?.secret ?? ''));
    expect(JSON.stringify(data)).not.toContain(parsed?.secret ?? 'unreachable');
  });

  it('binds the key to the project so ingestion never trusts the payload', async () => {
    const prisma = createPrisma();

    await build(prisma).create(owner, 'project-1', { name: 'CI/CD Pipeline' });

    const data = createdData(prisma);

    expect(data.projectId).toBe('project-1');
    expect(data.organizationId).toBe('org-1');
  });

  it('allows an admin to issue a key', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).create(admin, 'project-1', {
      name: 'CI/CD Pipeline',
    });

    expect(isOk(result)).toBe(true);
  });

  it('forbids a member from issuing a key', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).create(member, 'project-1', {
      name: 'CI/CD Pipeline',
    });

    expect(isErr(result) && result.error).toBe('forbidden');
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
  });
});

describe('ApiKeysService.revoke', () => {
  it('marks the key revoked instead of deleting the audit trail', async () => {
    const prisma = createPrisma();
    prisma.apiKey.findFirst.mockResolvedValue(row);

    await build(prisma).revoke(owner, 'project-1', 'key-1');

    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: { revokedAt: expect.any(Date) as Date },
      }),
    );
  });

  it('refuses a key that lives in another project', async () => {
    const prisma = createPrisma();
    prisma.apiKey.findFirst.mockResolvedValue(null);

    const result = await build(prisma).revoke(owner, 'project-1', 'key-9');

    expect(isErr(result) && result.error).toBe('not-found');
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it('forbids a member from revoking a key', async () => {
    const prisma = createPrisma();
    prisma.apiKey.findFirst.mockResolvedValue(row);

    const result = await build(prisma).revoke(member, 'project-1', 'key-1');

    expect(isErr(result) && result.error).toBe('forbidden');
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });
});

describe('ApiKeysService.authenticate', () => {
  function storedFor(token: string, overrides: Partial<typeof row> = {}) {
    const parsed = parseApiKeyToken(token);

    return {
      ...row,
      lookupId: parsed?.lookupId ?? '',
      hashedSecret: hashApiKeySecret(parsed?.secret ?? ''),
      ...overrides,
    };
  }

  it('resolves the project and organization from the key, not from the caller', async () => {
    const prisma = createPrisma();
    const generated = generateApiKeyToken();
    prisma.apiKey.findUnique.mockResolvedValue(storedFor(generated.token));

    const identity = await build(prisma).authenticate(generated.token);

    expect(identity).toEqual({
      apiKeyId: 'key-1',
      projectId: 'project-1',
      organizationId: 'org-1',
    });
  });

  it('rejects a malformed token without touching the database', async () => {
    const prisma = createPrisma();

    const identity = await build(prisma).authenticate('not-a-qably-token');

    expect(identity).toBeNull();
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a valid lookup id paired with the wrong secret', async () => {
    const prisma = createPrisma();
    const generated = generateApiKeyToken();
    const other = generateApiKeyToken();
    prisma.apiKey.findUnique.mockResolvedValue(
      storedFor(generated.token, {
        hashedSecret: hashApiKeySecret(
          parseApiKeyToken(other.token)?.secret ?? '',
        ),
      }),
    );

    expect(await build(prisma).authenticate(generated.token)).toBeNull();
  });

  it('rejects a revoked key', async () => {
    const prisma = createPrisma();
    const generated = generateApiKeyToken();
    prisma.apiKey.findUnique.mockResolvedValue(
      storedFor(generated.token, { revokedAt: new Date() }),
    );

    expect(await build(prisma).authenticate(generated.token)).toBeNull();
  });

  it('rejects an unknown lookup id', async () => {
    const prisma = createPrisma();
    prisma.apiKey.findUnique.mockResolvedValue(null);

    expect(
      await build(prisma).authenticate(generateApiKeyToken().token),
    ).toBeNull();
  });

  it('records first use so an unused key is visible in settings', async () => {
    const prisma = createPrisma();
    const generated = generateApiKeyToken();
    prisma.apiKey.findUnique.mockResolvedValue(
      storedFor(generated.token, { lastUsedAt: null }),
    );

    await build(prisma).authenticate(generated.token);

    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastUsedAt: expect.any(Date) as Date },
      }),
    );
  });

  it('does not write on every request when usage was already recorded', async () => {
    const prisma = createPrisma();
    const generated = generateApiKeyToken();
    prisma.apiKey.findUnique.mockResolvedValue(
      storedFor(generated.token, { lastUsedAt: new Date() }),
    );

    await build(prisma).authenticate(generated.token);

    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });
});

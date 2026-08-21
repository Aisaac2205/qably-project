import type { OrgContext } from '../organizations/organizations.contracts';
import { ProjectsService } from './projects.service';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const member: OrgContext = { ...owner, role: 'member' };

const row = {
  id: 'project-1',
  name: 'Checkout',
  description: null,
  githubRepo: null,
  technologies: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

interface FakePrisma {
  project: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  organization: { findUniqueOrThrow: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    project: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    organization: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ maxProjects: 3 }),
    },
  };
}

function build(prisma: FakePrisma) {
  return new ProjectsService(prisma as never);
}

describe('ProjectsService.list', () => {
  it('only reads projects of the caller organization', async () => {
    const prisma = createPrisma();
    prisma.project.findMany.mockResolvedValue([row]);

    await build(prisma).list(owner);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('serialises timestamps as iso strings', async () => {
    const prisma = createPrisma();
    prisma.project.findMany.mockResolvedValue([row]);

    const [project] = await build(prisma).list(owner);

    expect(project.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('ProjectsService.create', () => {
  it('stamps the caller organization onto the new project', async () => {
    const prisma = createPrisma();
    prisma.project.create.mockResolvedValue(row);

    const result = await build(prisma).create(owner, {
      name: 'Checkout',
      technologies: [],
    });

    expect(result.ok).toBe(true);

    const [call] = prisma.project.create.mock.calls as [
      [{ data: { organizationId: string } }],
    ];
    expect(call[0].data.organizationId).toBe('org-1');
  });

  it('refuses to exceed the plan project allowance', async () => {
    const prisma = createPrisma();
    prisma.project.count.mockResolvedValue(3);

    const result = await build(prisma).create(owner, {
      name: 'Checkout',
      technologies: [],
    });

    expect(result).toEqual({ ok: false, error: 'plan-limit-reached' });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('counts only the caller organization against the allowance', async () => {
    const prisma = createPrisma();
    prisma.project.create.mockResolvedValue(row);

    await build(prisma).create(owner, { name: 'Checkout', technologies: [] });

    expect(prisma.project.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
  });

  it('reports a duplicate name instead of leaking the database error', async () => {
    const prisma = createPrisma();
    prisma.project.create.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma).create(owner, {
      name: 'Checkout',
      technologies: [],
    });

    expect(result).toEqual({ ok: false, error: 'name-taken' });
  });

  it('lets any other database failure surface', async () => {
    const prisma = createPrisma();
    prisma.project.create.mockRejectedValue(new Error('connection lost'));

    await expect(
      build(prisma).create(owner, { name: 'Checkout', technologies: [] }),
    ).rejects.toThrow('connection lost');
  });
});

describe('ProjectsService.update', () => {
  it('refuses a project that belongs to another organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await build(prisma).update(owner, 'project-x', {
      name: 'New',
    });

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('applies the patch when the project is in scope', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.project.update.mockResolvedValue({ ...row, name: 'Payments' });

    const result = await build(prisma).update(owner, 'project-1', {
      name: 'Payments',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.name).toBe('Payments');
  });
});

describe('ProjectsService.remove', () => {
  it('lets an owner delete a project in scope', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });

    await expect(build(prisma).remove(owner, 'project-1')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(prisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
  });

  it('refuses a plain member before it even looks the project up', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).remove(member, 'project-1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('reports not-found for a project outside the organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(build(prisma).remove(owner, 'project-x')).resolves.toEqual({
      ok: false,
      error: 'not-found',
    });
  });
});

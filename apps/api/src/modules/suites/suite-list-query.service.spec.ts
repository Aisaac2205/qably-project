import { SUITE_RUN_WINDOW, type RunStatus } from '@qably/types';
import type { Prisma } from '../../../generated/prisma/client';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { SuiteSummaryRow } from './lib/suite-summaries-candidates';
import { SuiteListQueryService } from './suite-list-query.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

type RunsBySuite = Record<string, RunStatus[]>;

function createPrisma(rows: SuiteSummaryRow[], runs: RunsBySuite = {}) {
  return {
    suite: { findMany: jest.fn().mockResolvedValue(rows) },
    $queryRaw: jest.fn((sql: Prisma.Sql) => {
      const requested = sql.values.slice(2) as string[];

      return Promise.resolve(
        [...requested]
          .sort()
          .flatMap((suiteId) =>
            (runs[suiteId] ?? [])
              .slice(0, SUITE_RUN_WINDOW)
              .map((status) => ({ suiteId, status })),
          ),
      );
    }),
  };
}

type FakePrisma = ReturnType<typeof createPrisma>;

function build(prisma: FakePrisma): SuiteListQueryService {
  return new SuiteListQueryService(prisma as never);
}

describe('SuiteListQueryService.tags', () => {
  it('returns the distinct tags of the project in code unit order from one read of the tags column', async () => {
    const prisma = createPrisma([]);
    prisma.suite.findMany.mockResolvedValue([
      { tags: ['b', 'a'] },
      { tags: ['b', 'C'] },
      { tags: [] },
    ]);

    const result = await build(prisma).tags(org, { projectId: 'project-1' });

    expect(result).toEqual({ items: ['C', 'a', 'b'] });
    expect(prisma.suite.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.suite.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', projectId: 'project-1' },
      select: { tags: true },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['no suites', []],
    ['suites without tags', [{ tags: [] }, { tags: [] }]],
  ])('answers an empty list for %s', async (_label, rows) => {
    const prisma = createPrisma([]);
    prisma.suite.findMany.mockResolvedValue(rows);

    const result = await build(prisma).tags(org, { projectId: 'project-1' });

    expect(result).toEqual({ items: [] });
  });

  it('scopes the facet to the caller organization and project', async () => {
    const prisma = createPrisma([]);
    prisma.suite.findMany.mockResolvedValue([{ tags: ['x'] }]);

    await build(prisma).tags(
      { ...org, organizationId: 'org-9' },
      { projectId: 'project-7' },
    );

    expect(prisma.suite.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-9', projectId: 'project-7' },
      select: { tags: true },
    });
  });
});

import {
  SUITE_RUN_WINDOW,
  type RunStatus,
  type SuiteSortKey,
  type SuiteSummarySort,
} from '@qably/types';
import type { Prisma } from '../../../generated/prisma/client';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { SuiteSummaryRow } from './lib/suite-summaries-candidates';
import { decodeSuiteSummariesCursor } from './lib/suite-summaries-cursor';
import { SuiteListQueryService } from './suite-list-query.service';
import type { ListSuiteSummariesQuery } from './suites.schemas';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const SUMMARY_SELECT = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  tags: true,
  isDefault: true,
  createdAt: true,
  _count: { select: { cases: true } },
};

type RunsBySuite = Record<string, RunStatus[]>;

function at(seconds: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
}

function suiteRow(
  id: string,
  overrides: Partial<SuiteSummaryRow> = {},
): SuiteSummaryRow {
  return {
    id,
    projectId: 'project-1',
    name: `Suite ${id}`,
    description: '',
    tags: [],
    isDefault: false,
    createdAt: at(0),
    _count: { cases: 0 },
    ...overrides,
  };
}

function recentSuites(count: number): SuiteSummaryRow[] {
  return Array.from({ length: count }, (_value, position) =>
    suiteRow(`suite-${String(position).padStart(3, '0')}`, {
      createdAt: at(count - position),
    }),
  );
}

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

function query(
  overrides: Partial<ListSuiteSummariesQuery> = {},
): ListSuiteSummariesQuery {
  return {
    projectId: 'project-1',
    limit: 50,
    sort: 'recent',
    cursor: undefined,
    ...overrides,
  };
}

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

function cursorOf(nextCursor: string | null): SuiteSortKey {
  const decoded = decodeSuiteSummariesCursor(nextCursor ?? '');

  expect(decoded).not.toBeNull();

  return decoded as SuiteSortKey;
}

describe('SuiteListQueryService.page', () => {
  describe('scope and read shape', () => {
    it.each([
      ['org-1', 'project-1'],
      ['org-9', 'project-7'],
    ])(
      'reads the suites of organization %s and project %s with the summary columns and a case count only',
      async (organizationId, projectId) => {
        const prisma = createPrisma([]);

        await build(prisma).page(
          { ...org, organizationId },
          query({ projectId }),
        );

        expect(prisma.suite.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.suite.findMany).toHaveBeenCalledWith({
          where: { organizationId, projectId },
          select: SUMMARY_SELECT,
        });
      },
    );

    it('keeps the scope on the caller when a cursor is given, wherever the cursor came from', async () => {
      const prisma = createPrisma(recentSuites(3));
      const cursor: SuiteSortKey = {
        sort: 'recent',
        createdAt: at(2).toISOString(),
        id: 'suite-in-another-project',
      };

      await build(prisma).page(org, query({ cursor }));

      expect(prisma.suite.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', projectId: 'project-1' },
        select: SUMMARY_SELECT,
      });
    });
  });

  describe('response shape', () => {
    it('returns the summary fields, the case count and the derived status, never the cases', async () => {
      const rows = [
        suiteRow('suite-b', { createdAt: at(1) }),
        suiteRow('suite-a', {
          name: 'Payments',
          description: 'Card flows',
          tags: ['api', 'smoke'],
          isDefault: true,
          createdAt: new Date('2026-03-07T10:15:30.456Z'),
          _count: { cases: 5 },
        }),
      ];
      const runs: RunsBySuite = {
        'suite-a': ['fail', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
      };

      const result = await build(createPrisma(rows, runs)).page(org, query());

      expect(result).toEqual({
        items: [
          {
            id: 'suite-a',
            projectId: 'project-1',
            name: 'Payments',
            description: 'Card flows',
            tags: ['api', 'smoke'],
            isDefault: true,
            createdAt: '2026-03-07T10:15:30.456Z',
            caseCount: 5,
            status: 'fail',
            recentPassRate: 86,
          },
          {
            id: 'suite-b',
            projectId: 'project-1',
            name: 'Suite suite-b',
            description: '',
            tags: [],
            isDefault: false,
            createdAt: '2026-01-01T00:00:01.000Z',
            caseCount: 0,
            status: 'never-run',
            recentPassRate: null,
          },
        ],
        nextCursor: null,
      });
      expect(result.items[0]).not.toHaveProperty('cases');
    });

    it('answers a project without suites with an empty page and no run read', async () => {
      const prisma = createPrisma([]);

      const result = await build(prisma).page(org, query());

      expect(result).toEqual({ items: [], nextCursor: null });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('ordering', () => {
    const rows = [
      suiteRow('a', { name: 'beta', createdAt: at(1), _count: { cases: 3 } }),
      suiteRow('b', { name: 'Alpha', createdAt: at(2), _count: { cases: 10 } }),
      suiteRow('c', { name: 'alpha', createdAt: at(3) }),
      suiteRow('d', { name: 'Gamma', createdAt: at(4), _count: { cases: 3 } }),
    ];
    const runs: RunsBySuite = {
      a: ['pass'],
      b: ['fail', 'pass'],
      d: ['pass'],
    };

    it.each([
      ['recent', ['d', 'c', 'b', 'a']],
      ['name', ['b', 'c', 'a', 'd']],
      ['cases', ['b', 'd', 'a', 'c']],
      ['pass-rate', ['d', 'a', 'b', 'c']],
    ] as [SuiteSummarySort, string[]][])(
      'orders by %s whatever order the database returns',
      async (sort, expected) => {
        const prisma = createPrisma([...rows].reverse(), runs);

        const result = await build(prisma).page(org, query({ sort }));

        expect(ids(result.items)).toEqual(expected);
      },
    );
  });

  describe('paging', () => {
    it('serves 120 suites as pages of 50, 50 and 20 by following the cursor', async () => {
      const rows = recentSuites(120);
      const service = build(createPrisma([...rows].reverse()));

      const first = await service.page(org, query());
      const second = await service.page(
        org,
        query({ cursor: cursorOf(first.nextCursor) }),
      );
      const third = await service.page(
        org,
        query({ cursor: cursorOf(second.nextCursor) }),
      );

      expect([first, second, third].map((page) => page.items.length)).toEqual([
        50, 50, 20,
      ]);
      expect(third.nextCursor).toBeNull();
      expect([first, second, third].flatMap((page) => ids(page.items))).toEqual(
        ids(rows),
      );
    });
  });
});

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

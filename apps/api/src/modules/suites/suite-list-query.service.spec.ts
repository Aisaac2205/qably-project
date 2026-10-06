import {
  SUITE_RUN_WINDOW,
  type RunStatus,
  type SuiteRunStatus,
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
};

type RunsBySuite = Record<string, RunStatus[]>;
type CasesBySuite = Record<string, number>;

interface CaseCountArgs {
  where: { suiteId: { in: string[] } };
}

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

function createPrisma(
  rows: SuiteSummaryRow[],
  runs: RunsBySuite = {},
  cases: CasesBySuite = {},
) {
  return {
    suite: { findMany: jest.fn().mockResolvedValue(rows) },
    testCase: {
      groupBy: jest.fn((args: CaseCountArgs) =>
        Promise.resolve(
          [...args.where.suiteId.in]
            .sort()
            .filter((suiteId) => (cases[suiteId] ?? 0) > 0)
            .map((suiteId) => ({
              suiteId,
              _count: { _all: cases[suiteId] },
            })),
        ),
      ),
    },
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

function repeat(status: RunStatus, count: number): RunStatus[] {
  return Array.from({ length: count }, () => status);
}

function windowRead(prisma: FakePrisma, call = 0) {
  const [sql] = prisma.$queryRaw.mock.calls[call];

  return {
    window: sql.values[0] as number,
    organizationId: sql.values[1] as string,
    suiteIds: sql.values.slice(2) as string[],
  };
}

function runsFor(
  rows: readonly SuiteSummaryRow[],
  windowOf: (row: SuiteSummaryRow) => RunStatus[],
): RunsBySuite {
  return Object.fromEntries(rows.map((row) => [row.id, windowOf(row)]));
}

describe('SuiteListQueryService.page', () => {
  describe('scope and read shape', () => {
    it.each([
      ['org-1', 'project-1'],
      ['org-9', 'project-7'],
    ])(
      'reads the suites of organization %s and project %s with the summary columns only',
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

  describe('case counts', () => {
    it('counts the cases with one group by over the ids of the suites the caller read', async () => {
      const prisma = createPrisma(recentSuites(3), {}, { 'suite-001': 2 });

      await build(prisma).page(org, query());

      expect(prisma.testCase.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.testCase.groupBy).toHaveBeenCalledWith({
        by: ['suiteId'],
        where: { suiteId: { in: ['suite-000', 'suite-001', 'suite-002'] } },
        _count: { _all: true },
      });
    });

    it('leaves the suites that miss the search out of the count', async () => {
      const rows = recentSuites(6).map((row, position) => ({
        ...row,
        name: position % 2 === 0 ? `Alpha ${position}` : `Beta ${position}`,
      }));
      const prisma = createPrisma(rows);

      await build(prisma).page(org, query({ search: 'alpha' }));

      expect(prisma.testCase.groupBy).toHaveBeenCalledWith({
        by: ['suiteId'],
        where: { suiteId: { in: ['suite-000', 'suite-002', 'suite-004'] } },
        _count: { _all: true },
      });
    });

    it('counts every suite that passes the filters, not only the ones on the page', async () => {
      const prisma = createPrisma(recentSuites(120));

      const result = await build(prisma).page(org, query({ limit: 10 }));

      expect(result.items).toHaveLength(10);
      const [args] = prisma.testCase.groupBy.mock.calls[0];
      expect(args.where.suiteId.in).toHaveLength(120);
    });

    it('reports the count of the group and zero for a suite the group by does not return', async () => {
      const rows = [
        suiteRow('with-cases', { createdAt: at(2) }),
        suiteRow('empty', { createdAt: at(1) }),
      ];
      const prisma = createPrisma(rows, {}, { 'with-cases': 7 });

      const result = await build(prisma).page(org, query());

      expect(result.items.map((item) => [item.id, item.caseCount])).toEqual([
        ['with-cases', 7],
        ['empty', 0],
      ]);
    });

    it.each([
      ['a project without suites', [], undefined],
      ['a search nothing matches', recentSuites(3), 'nothing matches this'],
    ] as [string, SuiteSummaryRow[], string | undefined][])(
      'does not count anything for %s',
      async (_label, rows, search) => {
        const prisma = createPrisma(rows);

        const result = await build(prisma).page(org, query({ search }));

        expect(result).toEqual({ items: [], nextCursor: null });
        expect(prisma.suite.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.testCase.groupBy).not.toHaveBeenCalled();
      },
    );
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
        }),
      ];
      const runs: RunsBySuite = {
        'suite-a': ['fail', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
      };

      const result = await build(
        createPrisma(rows, runs, { 'suite-a': 5 }),
      ).page(org, query());

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
      expect(prisma.testCase.groupBy).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('ordering', () => {
    const rows = [
      suiteRow('a', { name: 'beta', createdAt: at(1) }),
      suiteRow('b', { name: 'Alpha', createdAt: at(2) }),
      suiteRow('c', { name: 'alpha', createdAt: at(3) }),
      suiteRow('d', { name: 'Gamma', createdAt: at(4) }),
    ];
    const runs: RunsBySuite = {
      a: ['pass'],
      b: ['fail', 'pass'],
      d: ['pass'],
    };
    const cases: CasesBySuite = { a: 3, b: 10, d: 3 };

    it.each([
      ['recent', ['d', 'c', 'b', 'a']],
      ['name', ['b', 'c', 'a', 'd']],
      ['cases', ['b', 'd', 'a', 'c']],
      ['pass-rate', ['d', 'a', 'b', 'c']],
    ] as [SuiteSummarySort, string[]][])(
      'orders by %s whatever order the database returns',
      async (sort, expected) => {
        const prisma = createPrisma([...rows].reverse(), runs, cases);

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

    it('finds the three failing suites at positions 7, 64 and 118 of 120 with limit 50 and no further page', async () => {
      const rows = recentSuites(120);
      const failing = [7, 64, 118].map((position) => rows[position].id);
      const runs = runsFor(rows, (row) =>
        failing.includes(row.id) ? ['fail', ...repeat('pass', 9)] : ['pass'],
      );

      const result = await build(createPrisma([...rows].reverse(), runs)).page(
        org,
        query({ status: 'fail' }),
      );

      expect(ids(result.items)).toEqual(failing);
      expect(
        result.items.map((item) => [item.status, item.recentPassRate]),
      ).toEqual([
        ['fail', 90],
        ['fail', 90],
        ['fail', 90],
      ]);
      expect(result.nextCursor).toBeNull();
    });

    it('keeps the pass rate order and the status across a cursor with a status filter', async () => {
      const rows = [
        suiteRow('pass-100', { createdAt: at(1) }),
        suiteRow('pass-90', { createdAt: at(2) }),
        suiteRow('pass-80', { createdAt: at(3) }),
        suiteRow('fail-90', { createdAt: at(4) }),
        suiteRow('never', { createdAt: at(5) }),
      ];
      const runs: RunsBySuite = {
        'pass-100': ['pass'],
        'pass-90': [...repeat('pass', 9), 'fail'],
        'pass-80': [...repeat('pass', 8), 'fail', 'fail'],
        'fail-90': ['fail', ...repeat('pass', 9)],
      };
      const service = build(createPrisma([...rows].reverse(), runs));
      const base = { sort: 'pass-rate', status: 'pass', limit: 2 } as const;

      const first = await service.page(org, query(base));
      const second = await service.page(
        org,
        query({ ...base, cursor: cursorOf(first.nextCursor) }),
      );

      expect(ids(first.items)).toEqual(['pass-100', 'pass-90']);
      expect(ids(second.items)).toEqual(['pass-80']);
      expect(second.nextCursor).toBeNull();
      expect(
        [...first.items, ...second.items].map((item) => item.status),
      ).toEqual(['pass', 'pass', 'pass']);
    });

    it('applies search, tag and status before cutting the page', async () => {
      const rows = [
        suiteRow('a', { name: 'Checkout', tags: ['api'], createdAt: at(1) }),
        suiteRow('b', {
          name: 'Checkout cart',
          tags: ['web'],
          createdAt: at(2),
        }),
        suiteRow('c', { name: 'Billing', tags: ['api'], createdAt: at(3) }),
        suiteRow('d', {
          name: 'Checkout export',
          tags: ['api'],
          createdAt: at(4),
        }),
        suiteRow('e', {
          name: 'checkout api',
          tags: ['api'],
          createdAt: at(5),
        }),
      ];
      const runs: RunsBySuite = {
        a: ['pass'],
        b: ['pass'],
        c: ['pass'],
        d: ['fail', 'pass', 'pass', 'pass'],
        e: ['pass'],
      };
      const service = build(createPrisma(rows, runs));
      const filters = {
        search: 'checkout',
        tag: 'api',
        status: 'pass',
        limit: 1,
      } as const;

      const first = await service.page(org, query(filters));
      const second = await service.page(
        org,
        query({ ...filters, cursor: cursorOf(first.nextCursor) }),
      );

      expect(ids(first.items)).toEqual(['e']);
      expect(first.nextCursor).not.toBeNull();
      expect(ids(second.items)).toEqual(['a']);
      expect(second.nextCursor).toBeNull();
    });
  });

  describe('bounded reads', () => {
    const variants = [
      ['recent', undefined],
      ['name', undefined],
      ['cases', undefined],
      ['pass-rate', undefined],
      ['recent', 'fail'],
    ] as [SuiteSummarySort, SuiteRunStatus | undefined][];

    it.each(
      variants.flatMap(([sort, status]) =>
        [1, 100].map((count) => [sort, status, count] as const),
      ),
    )(
      'reads the suites once, the case counts once and the run windows once for sort %s and status %s with %i suites',
      async (sort, status, count) => {
        const prisma = createPrisma(recentSuites(count));

        await build(prisma).page(org, query({ sort, status, limit: 100 }));

        expect(prisma.suite.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.testCase.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['recent', 'name', 'cases'] as SuiteSummarySort[])(
      'reads the runs of the page only, not of the whole project, for sort %s',
      async (sort) => {
        const prisma = createPrisma(recentSuites(120));
        const service = build(prisma);

        const first = await service.page(org, query({ sort }));
        const second = await service.page(
          org,
          query({ sort, cursor: cursorOf(first.nextCursor) }),
        );

        expect(windowRead(prisma, 0).suiteIds).toEqual(ids(first.items));
        expect(windowRead(prisma, 1).suiteIds).toEqual(ids(second.items));
        expect(windowRead(prisma, 0).suiteIds).toHaveLength(50);
        expect(windowRead(prisma, 0).window).toBe(10);
        expect(windowRead(prisma, 0).organizationId).toBe('org-1');
      },
    );

    it.each([
      ['pass-rate', undefined],
      ['recent', 'pass'],
      ['name', 'fail'],
      ['cases', 'never-run'],
    ] as [SuiteSummarySort, SuiteRunStatus | undefined][])(
      'reads a window of 10 for every suite that passes the filters for sort %s and status %s',
      async (sort, status) => {
        const rows = recentSuites(120);
        const prisma = createPrisma(rows);

        await build(prisma).page(org, query({ sort, status, limit: 10 }));

        const read = windowRead(prisma);
        expect(read.window).toBe(10);
        expect(read.organizationId).toBe('org-1');
        expect([...read.suiteIds].sort()).toEqual(ids(rows).sort());
      },
    );

    it('leaves the suites that miss the search out of the window read', async () => {
      const rows = recentSuites(12).map((row, position) => ({
        ...row,
        name: position % 2 === 0 ? `Alpha ${position}` : `Beta ${position}`,
      }));
      const prisma = createPrisma(rows);

      await build(prisma).page(
        org,
        query({ sort: 'pass-rate', search: 'alpha' }),
      );

      expect([...windowRead(prisma).suiteIds].sort()).toEqual(
        ids(rows.filter((row) => row.name.startsWith('Alpha'))).sort(),
      );
    });

    it('skips the window read when no suite survives the filters', async () => {
      const prisma = createPrisma(recentSuites(5));

      const result = await build(prisma).page(
        org,
        query({ search: 'nothing matches this', status: 'fail' }),
      );

      expect(result).toEqual({ items: [], nextCursor: null });
      expect(prisma.suite.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.testCase.groupBy).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
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

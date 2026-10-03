import type { RunStatus } from '@qably/types';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { CiRunRow } from './lib/ci-run-view';
import { CiRunsService } from './ci-runs.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

function ciRunRow(overrides: Partial<CiRunRow> = {}): CiRunRow {
  return {
    id: 'ci-run-1',
    projectId: 'project-1',
    source: 'github_actions',
    externalId: '900',
    workflowName: 'CI',
    runNumber: 42,
    runAttempt: 1,
    branch: 'main',
    headRef: null,
    actor: 'ana',
    eventName: 'push',
    serverUrl: 'https://github.com',
    repository: 'acme/shop',
    commitSha: '1f2e3d4c5b6a79880011223344556677889900aa',
    commitMessage: 'fix: keep the cart total in sync',
    commitAuthor: 'Ana Lopez',
    startedAt: new Date('2026-10-03T14:00:00.000Z'),
    lastReportedAt: new Date('2026-10-03T14:12:20.000Z'),
    ...overrides,
  };
}

function ciRunRows(count: number): CiRunRow[] {
  return Array.from({ length: count }, (_, index) =>
    ciRunRow({
      id: `ci-run-${String(count - index).padStart(3, '0')}`,
      externalId: String(900 + count - index),
    }),
  );
}

interface StatusGroup {
  ciRunId: string;
  status: RunStatus;
}

function createPrisma(rows: CiRunRow[] = [], groups: StatusGroup[] = []) {
  return {
    ciRun: { findMany: jest.fn().mockResolvedValue(rows) },
    run: { groupBy: jest.fn().mockResolvedValue(groups) },
  };
}

function build(prisma: ReturnType<typeof createPrisma>) {
  return new CiRunsService(prisma as never);
}

describe('CiRunsService.list', () => {
  it('scopes the CI run read to the caller organization and the project', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { projectId: 'project-1', limit: 25 });

    expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });

  it('uses the organization of the caller, not a fixed one', async () => {
    const prisma = createPrisma();

    await build(prisma).list(
      { ...org, organizationId: 'org-2' },
      { projectId: 'project-9', limit: 25 },
    );

    expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-2', projectId: 'project-9' },
      }),
    );
  });

  it('orders by startedAt then id, both descending', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { projectId: 'project-1', limit: 25 });

    expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('reads one extra row to decide whether another page exists', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { projectId: 'project-1', limit: 10 });

    expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 11 }),
    );
  });

  it('resumes after the cursor row instead of repeating it', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 25,
      cursor: 'ci-run-007',
    });

    expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'ci-run-007' }, skip: 1 }),
    );
  });

  it('sends neither cursor nor skip on the first page', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { projectId: 'project-1', limit: 25 });

    const [[args]] = prisma.ciRun.findMany.mock.calls as [
      [Record<string, unknown>],
    ];
    expect(args).not.toHaveProperty('cursor');
    expect(args).not.toHaveProperty('skip');
  });

  it('reads a page of 25 with exactly two queries, not one per row', async () => {
    const prisma = createPrisma(ciRunRows(25));

    const page = await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 25,
    });

    expect(page.items).toHaveLength(25);
    expect(prisma.ciRun.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(1);
  });

  it('aggregates run statuses once for the ids on the page, scoped to the organization', async () => {
    const prisma = createPrisma(ciRunRows(3));

    await build(prisma).list(org, { projectId: 'project-1', limit: 25 });

    expect(prisma.run.groupBy).toHaveBeenCalledWith({
      by: ['ciRunId', 'status'],
      where: {
        organizationId: 'org-1',
        ciRunId: { in: ['ci-run-003', 'ci-run-002', 'ci-run-001'] },
      },
      orderBy: { ciRunId: 'asc' },
    });
  });

  it('derives the status of each row from its own runs', async () => {
    const prisma = createPrisma(
      [
        ciRunRow({ id: 'ci-run-a' }),
        ciRunRow({ id: 'ci-run-b' }),
        ciRunRow({ id: 'ci-run-c' }),
        ciRunRow({ id: 'ci-run-d' }),
      ],
      [
        { ciRunId: 'ci-run-a', status: 'pass' },
        { ciRunId: 'ci-run-a', status: 'fail' },
        { ciRunId: 'ci-run-b', status: 'pass' },
        { ciRunId: 'ci-run-d', status: 'running' },
        { ciRunId: 'ci-run-d', status: 'pending' },
      ],
    );

    const page = await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 25,
    });

    expect(page.items.map((item) => [item.id, item.status])).toEqual([
      ['ci-run-a', 'failing'],
      ['ci-run-b', 'passing'],
      ['ci-run-c', 'passing'],
      ['ci-run-d', 'passing'],
    ]);
  });

  it('returns summaries without a runs list and without null columns', async () => {
    const prisma = createPrisma([ciRunRow({ headRef: null })]);

    const page = await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 25,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'ci-run-1',
      externalId: '900',
      status: 'passing',
      startedAt: '2026-10-03T14:00:00.000Z',
      lastReportedAt: '2026-10-03T14:12:20.000Z',
    });
    expect(page.items[0]).not.toHaveProperty('runs');
    expect(page.items[0]).not.toHaveProperty('headRef');
  });

  it('returns a cursor pointing at the last item of a full page, not at the extra row', async () => {
    const prisma = createPrisma(ciRunRows(3));

    const page = await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 2,
    });

    expect(page.items.map((item) => item.id)).toEqual([
      'ci-run-003',
      'ci-run-002',
    ]);
    expect(page.nextCursor).toBe('ci-run-002');
  });

  it('omits the cursor when the page is the last one', async () => {
    const prisma = createPrisma(ciRunRows(2));

    const page = await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page).not.toHaveProperty('nextCursor');
  });

  it('answers an empty page without aggregating anything when no row matches', async () => {
    const prisma = createPrisma([]);

    const page = await build(prisma).list(org, {
      projectId: 'project-1',
      limit: 25,
      cursor: 'ci-run-unknown',
    });

    expect(page).toEqual({ items: [] });
    expect(prisma.run.groupBy).not.toHaveBeenCalled();
  });
});

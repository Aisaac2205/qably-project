import type { OrgContext } from '../organizations/organizations.contracts';
import { DashboardService } from './dashboard.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

interface FakePrisma {
  project: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
}

function createPrisma(): FakePrisma {
  return {
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

function build(prisma: FakePrisma) {
  return new DashboardService(prisma as never, { list: jest.fn() } as never);
}

function paramsOf(prisma: FakePrisma, call: number): unknown[] {
  const [sql] = prisma.$queryRaw.mock.calls[call] as [{ values: unknown[] }];

  return sql.values;
}

function statementOf(prisma: FakePrisma, call: number): string {
  const [sql] = prisma.$queryRaw.mock.calls[call] as [{ strings: string[] }];

  return sql.strings.join(' ');
}

describe('DashboardService.traceability', () => {
  it('queries one aggregate per stage that has a source', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
  });

  it('merges the per-stage day counts into one calendar', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ day: '2026-06-16', count: 2 }])
      .mockResolvedValueOnce([{ day: '2026-06-16', count: 7 }])
      .mockResolvedValueOnce([{ day: '2026-06-16', count: 5 }])
      .mockResolvedValueOnce([{ day: '2026-06-16', count: 214 }]);

    const result = await build(prisma).traceability(org, 2026);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.days).toEqual([
      { date: '2026-06-16', scm: 2, proposals: 7, official: 5, runs: 214 },
    ]);
    expect(result.ok && result.value.totals).toEqual({
      scm: 2,
      proposals: 7,
      official: 5,
      runs: 214,
    });
  });

  it('counts the proposals stage from the review domain table', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    expect(statementOf(prisma, 1)).toContain('extracted_proposal');
  });

  it('scopes every stage to the caller organization', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    for (let call = 0; call < 4; call += 1) {
      expect(paramsOf(prisma, call)).toContain('org-1');
    }
  });

  it('scopes every stage to the project when one is requested', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026, 'project-1');

    for (let call = 0; call < 4; call += 1) {
      expect(paramsOf(prisma, call)).toContain('project-1');
    }
  });

  it('bounds every stage to the requested year', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    for (let call = 0; call < 4; call += 1) {
      const params = paramsOf(prisma, call);

      expect(params).toContain('2026-01-01');
      expect(params).toContain('2027-01-01');
    }
  });

  it('buckets and bounds in the configured time zone', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    expect(paramsOf(prisma, 0)).toContain('America/Guatemala');
    expect(statementOf(prisma, 0)).toContain('AT TIME ZONE');
  });

  it('filters on the raw timestamp so the range stays index-usable', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    for (let call = 0; call < 4; call += 1) {
      expect(statementOf(prisma, call)).not.toMatch(
        /WHERE[\s\S]*date_trunc|WHERE[\s\S]*to_char[\s\S]*>=/,
      );
    }
  });

  it('counts as an int so the driver never hands back a bigint', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    for (let call = 0; call < 4; call += 1) {
      expect(statementOf(prisma, call)).toContain('COUNT(*)::int');
    }
  });

  it('returns project-not-found for a project outside the organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await build(prisma).traceability(org, 2026, 'project-x');

    expect(result).toEqual({ ok: false, error: 'project-not-found' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('never looks up a single project when none is requested', async () => {
    const prisma = createPrisma();

    await build(prisma).traceability(org, 2026);

    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('reports an empty year rather than failing when nothing happened', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).traceability(org, 2026);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.days).toEqual([]);
    expect(result.ok && result.value.year).toBe(2026);
    expect(result.ok && result.value.timeZone).toBe('America/Guatemala');
  });
});

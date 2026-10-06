import type { PrismaService } from '../../../prisma/prisma.service';

export interface SuiteCaseCountRow {
  suiteId: string;
  _count: { _all: number };
}

interface SuiteCaseCountReader {
  testCase: Pick<PrismaService['testCase'], 'groupBy'>;
}

export function countCasesBySuite(
  rows: readonly SuiteCaseCountRow[],
): Map<string, number> {
  return new Map(rows.map((row) => [row.suiteId, row._count._all]));
}

export async function readSuiteCaseCounts(
  prisma: SuiteCaseCountReader,
  suiteIds: readonly string[],
): Promise<Map<string, number>> {
  if (suiteIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.testCase.groupBy({
    by: ['suiteId'],
    where: { suiteId: { in: [...suiteIds] } },
    _count: { _all: true },
  });

  return countCasesBySuite(rows);
}

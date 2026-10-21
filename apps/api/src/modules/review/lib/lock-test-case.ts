import type { PrismaService } from '../../../prisma/prisma.service';

export interface TestCaseLockClient {
  $queryRawUnsafe: PrismaService['$queryRawUnsafe'];
}

export interface LockedTestCase {
  currentVersionId: string | null;
}

/**
 * Takes the row lock on one test case for the rest of the transaction and
 * returns its current version id as of the moment the lock was granted.
 *
 * Every writer that publishes a version takes this lock before it counts the
 * case's versions, so version n+1 is computed by one writer at a time. A
 * transaction that also spends an Aeris credit must spend it first: the lock
 * order is the organization row, then the test case rows.
 *
 * The mode is FOR NO KEY UPDATE, the lock a plain UPDATE of the row takes:
 * it serializes the writers of the case, but still lets a proposal that
 * references the case take its foreign-key share lock. FOR UPDATE would block
 * that share lock, so a reclassify holding a proposal of this case and an
 * approval holding the case would wait on each other.
 */
export async function lockTestCaseForUpdate(
  tx: TestCaseLockClient,
  testCaseId: string,
): Promise<LockedTestCase | null> {
  const rows = await tx.$queryRawUnsafe<{ currentVersionId: string | null }[]>(
    `SELECT "currentVersionId" FROM "test_case" WHERE id = $1 FOR NO KEY UPDATE`,
    testCaseId,
  );

  const row = rows[0];
  if (row === undefined) return null;

  return { currentVersionId: row.currentVersionId };
}

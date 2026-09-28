export const PUSH_PASS_RATE_DEFAULT_DAYS = 30;

const SHORT_SHA_LENGTH = 7;

export interface PushPassRateRow {
  commitSha: string;
  startedAt: Date;
  open: number;
  close: number;
  high: number;
  low: number;
  runCount: number;
  passRate: number;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
}

export function toShortSha(commitSha: string): string {
  return commitSha.slice(0, SHORT_SHA_LENGTH);
}

export const PUSH_PASS_RATE_SQL = `
  WITH run_pass_rates AS (
    SELECT r.id,
           r."startedAt",
           r."commitSha",
           (COUNT(*) FILTER (WHERE rc.status = 'pass'))::float
             / COUNT(*) FILTER (WHERE rc.status IN ('pass', 'fail', 'blocked')) AS "passRate",
           (COUNT(*) FILTER (WHERE rc.status = 'pass'))::int AS "passCount",
           (COUNT(*) FILTER (WHERE rc.status IN ('pass', 'fail', 'blocked')))::int AS "decidedCount",
           (COUNT(*))::int AS "executedCount",
           (COUNT(*) FILTER (WHERE rc.status = 'fail'))::int AS "failedCount",
           (COUNT(*) FILTER (WHERE rc.status = 'blocked'))::int AS "blockedCount"
      FROM "run" r
      JOIN "run_case" rc ON rc."runId" = r.id
     WHERE r."organizationId" = $1
       AND r."projectId" = $2
       AND r.status IN ('pass', 'fail')
       AND r."startedAt" >= $3
       AND r."commitSha" IS NOT NULL
     GROUP BY r.id
    HAVING COUNT(*) FILTER (WHERE rc.status IN ('pass', 'fail', 'blocked')) > 0
  ),
  ranked AS (
    SELECT "commitSha",
           "startedAt",
           "passRate",
           "passCount",
           "decidedCount",
           "executedCount",
           "failedCount",
           "blockedCount",
           ROW_NUMBER() OVER (
             PARTITION BY "commitSha"
             ORDER BY "startedAt" ASC, id ASC
           ) AS "rankAsc",
           ROW_NUMBER() OVER (
             PARTITION BY "commitSha"
             ORDER BY "startedAt" DESC, id DESC
           ) AS "rankDesc"
      FROM run_pass_rates
  )
  SELECT "commitSha",
         MIN("startedAt") AS "startedAt",
         MAX("passRate") FILTER (WHERE "rankAsc" = 1) AS open,
         MAX("passRate") FILTER (WHERE "rankDesc" = 1) AS close,
         MAX("passRate") AS high,
         MIN("passRate") AS low,
         (COUNT(*))::int AS "runCount",
         (SUM("passCount"))::float / SUM("decidedCount") AS "passRate",
         (SUM("executedCount"))::int AS "executed",
         (SUM("passCount"))::int AS "passed",
         (SUM("failedCount"))::int AS "failed",
         (SUM("blockedCount"))::int AS "blocked"
    FROM ranked
   GROUP BY "commitSha"
   ORDER BY MIN("startedAt") ASC
`;

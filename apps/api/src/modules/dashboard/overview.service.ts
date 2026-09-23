import { Injectable } from '@nestjs/common';
import type {
  CaseStatus,
  DashboardOverviewRecord,
  DashboardPeriod,
} from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import {
  calendarDayKeys,
  computeCalendarWindow,
} from '../../common/metrics/calendar-window';
import {
  buildDashboardOverview,
  type RecentRunRow,
  type SeriesWindow,
} from '../../common/metrics/dashboard-overview';
import {
  RECENT_ACTIVITY_LIMIT,
  buildRecentActivityFromAggregates,
  type ActivityAggregateRow,
} from '../../common/metrics/recent-activity';
import {
  buildCaseCountsByRun,
  emptyCaseCounts,
} from '../../common/metrics/run-case-metrics';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { DashboardError } from './dashboard.contracts';
import { isUnknownTimeZoneError } from './lib/time-zone-error';

const RECENT_RUNS_LIMIT = 4;

interface RawCaseCountRow {
  projectId: string;
  window: SeriesWindow;
  day: string;
  status: CaseStatus;
  count: number;
}

interface RawRunCountRow {
  window: SeriesWindow;
  day: string;
  runs: number;
  failedRuns: number;
  finishedRuns: number;
  durationSumMs: number;
}

interface RawCasesPassingRow {
  status: CaseStatus;
  count: number;
}

interface RecentRunListRow {
  id: string;
  projectId: string;
  project: { name: string };
  suiteId: string;
  suite: { name: string };
  name: string;
  status: 'pass' | 'fail' | 'running' | 'pending';
  source: 'manual' | 'api' | 'github_actions';
  startedAt: Date;
  finishedAt: Date | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
}

interface RawActivityCandidateRow {
  projectId: string;
  activityKey: string;
  commitSha: string | null;
  lastActivityAt: Date;
}

interface RawActivityAggregateRow {
  projectId: string;
  activityKey: string;
  commitSha: string | null;
  suiteCount: number;
  statuses: ('pass' | 'fail' | 'running' | 'pending')[];
  anchorRunId: string;
  anchorRunName: string;
  anchorSuiteName: string;
  anchorSource: 'manual' | 'api' | 'github_actions';
  anchorStartedAt: Date;
  anchorCommitMessage: string | null;
  anchorCommitAuthor: string | null;
  projectName: string;
  casesPassed: number;
  casesTotal: number;
}

function projectFilterSql(projectId?: string): Prisma.Sql {
  return projectId === undefined
    ? Prisma.empty
    : Prisma.sql`AND r."projectId" = ${projectId}`;
}

function suiteProjectFilterSql(projectId?: string): Prisma.Sql {
  return projectId === undefined
    ? Prisma.empty
    : Prisma.sql`AND s."projectId" = ${projectId}`;
}

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    org: OrgContext,
    period: DashboardPeriod,
    zone: string,
    projectId?: string,
  ): Promise<Result<DashboardOverviewRecord, DashboardError>> {
    if (projectId !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId: org.organizationId },
        select: { id: true },
      });

      if (project === null) return err('project-not-found');
    }

    const organizationId = org.organizationId;
    const now = new Date();
    const window = computeCalendarWindow(period, zone, now);
    const dayKeys = calendarDayKeys(period, zone, now);
    const runProjectFilter = projectFilterSql(projectId);
    const suiteProjectFilter = suiteProjectFilterSql(projectId);

    try {
      const [
        caseCountRows,
        runCountRows,
        casesPassingRows,
        projects,
        suiteCounts,
        testCaseCounts,
        lastRunAts,
        recentRuns,
        activityCandidates,
      ] = await Promise.all([
        this.prisma.$queryRaw<RawCaseCountRow[]>(Prisma.sql`
          SELECT r."projectId" AS "projectId",
                 CASE WHEN r."startedAt" >= ${window.currentStart} THEN 'current' ELSE 'previous' END AS window,
                 to_char((r."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS day,
                 rc.status AS status,
                 COUNT(*)::int AS count
            FROM "run_case" rc
            JOIN "run" r ON r.id = rc."runId"
           WHERE r."organizationId" = ${organizationId}
             ${runProjectFilter}
             AND r."startedAt" >= ${window.previousStart}
             AND r."startedAt" < ${window.currentEnd}
           GROUP BY 1, 2, 3, 4
        `),
        this.prisma.$queryRaw<RawRunCountRow[]>(Prisma.sql`
          SELECT CASE WHEN r."startedAt" >= ${window.currentStart} THEN 'current' ELSE 'previous' END AS window,
                 to_char((r."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS runs,
                 COUNT(*) FILTER (WHERE r.status = 'fail')::int AS "failedRuns",
                 COUNT(*) FILTER (WHERE r."finishedAt" IS NOT NULL)::int AS "finishedRuns",
                 COALESCE(SUM(EXTRACT(EPOCH FROM (r."finishedAt" - r."startedAt")) * 1000) FILTER (WHERE r."finishedAt" IS NOT NULL), 0)::float8 AS "durationSumMs"
            FROM "run" r
           WHERE r."organizationId" = ${organizationId}
             ${runProjectFilter}
             AND r."startedAt" >= ${window.previousStart}
             AND r."startedAt" < ${window.currentEnd}
           GROUP BY 1, 2
        `),
        this.prisma.$queryRaw<RawCasesPassingRow[]>(Prisma.sql`
          WITH latest AS (
            SELECT r.id AS "runId",
                   ROW_NUMBER() OVER (
                     PARTITION BY r."suiteId" ORDER BY r."startedAt" DESC, r.id DESC
                   ) AS rn
              FROM "run" r
              JOIN "suite" s ON s.id = r."suiteId"
             WHERE r."organizationId" = ${organizationId}
               AND s."organizationId" = ${organizationId}
               ${suiteProjectFilter}
               ${runProjectFilter}
               AND r.status IN ('pass', 'fail')
               AND r."finishedAt" IS NOT NULL
          )
          SELECT rc.status AS status, COUNT(*)::int AS count
            FROM "run_case" rc
            JOIN latest l ON l."runId" = rc."runId"
           WHERE l.rn = 1
           GROUP BY 1
        `),
        this.prisma.project.findMany({
          where: {
            organizationId,
            ...(projectId === undefined ? {} : { id: projectId }),
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.suite.groupBy({
          by: ['projectId'],
          where: {
            organizationId,
            ...(projectId === undefined ? {} : { projectId }),
          },
          _count: { _all: true },
        }),
        this.prisma.testCase.groupBy({
          by: ['projectId'],
          where: {
            state: 'active',
            project: {
              organizationId,
              ...(projectId === undefined ? {} : { id: projectId }),
            },
          },
          _count: { _all: true },
        }),
        this.prisma.run.groupBy({
          by: ['projectId'],
          where: {
            organizationId,
            ...(projectId === undefined ? {} : { projectId }),
          },
          _max: { startedAt: true },
        }),
        this.prisma.run.findMany({
          where: {
            organizationId,
            ...(projectId === undefined ? {} : { projectId }),
          },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: RECENT_RUNS_LIMIT,
          select: {
            id: true,
            projectId: true,
            project: { select: { name: true } },
            suiteId: true,
            suite: { select: { name: true } },
            name: true,
            status: true,
            source: true,
            startedAt: true,
            finishedAt: true,
            commitSha: true,
            commitMessage: true,
            commitAuthor: true,
          },
        }),
        this.prisma.$queryRaw<RawActivityCandidateRow[]>(Prisma.sql`
          WITH activity_candidates AS (
            SELECT r."projectId" AS "projectId",
                   COALESCE(r."commitSha", r.id::text) AS "activityKey",
                   r."commitSha" AS "commitSha",
                   r."startedAt" AS "startedAt"
              FROM "run" r
             WHERE r."organizationId" = ${organizationId}
               ${runProjectFilter}
               AND r."startedAt" >= ${window.currentStart}
               AND r."startedAt" < ${window.currentEnd}
          )
          SELECT "projectId" AS "projectId",
                 "activityKey" AS "activityKey",
                 MAX("commitSha") AS "commitSha",
                 MAX("startedAt") AS "lastActivityAt"
            FROM activity_candidates
           GROUP BY "projectId", "activityKey"
           ORDER BY MAX("startedAt") DESC, "activityKey" DESC
           LIMIT ${RECENT_ACTIVITY_LIMIT}
        `),
      ]);

      const recentRunRows = recentRuns as RecentRunListRow[];
      const recentRunCaseGroups =
        recentRunRows.length === 0
          ? []
          : await this.prisma.runCase.groupBy({
              by: ['runId', 'status'],
              where: { runId: { in: recentRunRows.map((run) => run.id) } },
              _count: { _all: true },
            });
      const caseCountsByRun = buildCaseCountsByRun(recentRunCaseGroups);

      const activityAggregateRows =
        activityCandidates.length === 0
          ? []
          : await this.prisma.$queryRaw<RawActivityAggregateRow[]>(Prisma.sql`
              WITH matched_runs AS (
                SELECT DISTINCT ON (
                         r."projectId",
                         COALESCE(r."commitSha", r.id::text),
                         r."suiteId"
                       )
                       r.id AS "runId",
                       r."projectId" AS "projectId",
                       COALESCE(r."commitSha", r.id::text) AS "activityKey",
                       r."commitSha" AS "commitSha",
                       r."commitMessage" AS "commitMessage",
                       r."commitAuthor" AS "commitAuthor",
                       r."suiteId" AS "suiteId",
                       r.name AS "runName",
                       s.name AS "suiteName",
                       r.status AS "status",
                       r.source AS "source",
                       r."startedAt" AS "startedAt"
                  FROM "run" r
                  JOIN "suite" s ON s.id = r."suiteId"
                 WHERE r."organizationId" = ${organizationId}
                   ${runProjectFilter}
                   AND r."startedAt" >= ${window.currentStart}
                   AND r."startedAt" < ${window.currentEnd}
                   AND (r."projectId", COALESCE(r."commitSha", r.id::text)) IN (${Prisma.join(
                     activityCandidates.map(
                       (candidate) =>
                         Prisma.sql`(${candidate.projectId}, ${candidate.activityKey})`,
                     ),
                   )})
                 ORDER BY r."projectId",
                          COALESCE(r."commitSha", r.id::text),
                          r."suiteId",
                          r."startedAt" DESC,
                          r.id DESC
              ),
              rollups AS (
                SELECT mr."projectId" AS "projectId",
                       mr."activityKey" AS "activityKey",
                       mr."commitSha" AS "commitSha",
                       COUNT(*)::int AS "suiteCount",
                       array_agg(DISTINCT mr.status)::text[] AS "statuses"
                  FROM matched_runs mr
                 GROUP BY mr."projectId", mr."activityKey", mr."commitSha"
              ),
              anchors AS (
                SELECT DISTINCT ON (mr."projectId", mr."activityKey")
                       mr."projectId" AS "projectId",
                       mr."activityKey" AS "activityKey",
                       mr."runId" AS "anchorRunId",
                       mr."runName" AS "anchorRunName",
                       mr."suiteName" AS "anchorSuiteName",
                       mr.source AS "anchorSource",
                       mr."startedAt" AS "anchorStartedAt",
                       mr."commitMessage" AS "anchorCommitMessage",
                       mr."commitAuthor" AS "anchorCommitAuthor"
                  FROM matched_runs mr
                 ORDER BY mr."projectId",
                          mr."activityKey",
                          mr."startedAt" DESC,
                          mr."runId" DESC
              ),
              case_counts AS (
                SELECT mr."projectId" AS "projectId",
                       mr."activityKey" AS "activityKey",
                       COUNT(*) FILTER (WHERE rc.status = 'pass')::int AS "casesPassed",
                       COUNT(rc.id)::int AS "casesTotal"
                  FROM matched_runs mr
                  JOIN "run_case" rc ON rc."runId" = mr."runId"
                 GROUP BY mr."projectId", mr."activityKey"
              )
              SELECT rl."projectId" AS "projectId",
                     rl."activityKey" AS "activityKey",
                     rl."commitSha" AS "commitSha",
                     rl."suiteCount" AS "suiteCount",
                     rl.statuses AS "statuses",
                     a."anchorRunId" AS "anchorRunId",
                     a."anchorRunName" AS "anchorRunName",
                     a."anchorSuiteName" AS "anchorSuiteName",
                     a."anchorSource" AS "anchorSource",
                     a."anchorStartedAt" AS "anchorStartedAt",
                     a."anchorCommitMessage" AS "anchorCommitMessage",
                     a."anchorCommitAuthor" AS "anchorCommitAuthor",
                     p.name AS "projectName",
                     COALESCE(cc."casesPassed", 0) AS "casesPassed",
                     COALESCE(cc."casesTotal", 0) AS "casesTotal"
                FROM rollups rl
                JOIN anchors a
                  ON a."projectId" = rl."projectId"
                 AND a."activityKey" = rl."activityKey"
                JOIN "project" p ON p.id = rl."projectId"
                LEFT JOIN case_counts cc
                  ON cc."projectId" = rl."projectId"
                 AND cc."activityKey" = rl."activityKey"
            `);

      const recentActivity = buildRecentActivityFromAggregates(
        activityAggregateRows.map(
          (row): ActivityAggregateRow => ({
            projectId: row.projectId,
            activityKey: row.activityKey,
            commitSha: row.commitSha,
            projectName: row.projectName,
            suiteCount: row.suiteCount,
            statuses: row.statuses,
            anchorRunId: row.anchorRunId,
            anchorRunName: row.anchorRunName,
            anchorSuiteName: row.anchorSuiteName,
            anchorSource: row.anchorSource,
            anchorStartedAt: row.anchorStartedAt,
            anchorCommitMessage: row.anchorCommitMessage,
            anchorCommitAuthor: row.anchorCommitAuthor,
            casesPassed: row.casesPassed,
            casesTotal: row.casesTotal,
          }),
        ),
      );

      const record = buildDashboardOverview({
        period,
        zone,
        currentDayKeys: dayKeys.current,
        previousDayKeys: dayKeys.previous,
        caseCountRows,
        runCountRows,
        casesPassingRows,
        projects,
        suiteCountByProjectId: new Map(
          suiteCounts.map((row) => [row.projectId, row._count._all]),
        ),
        caseCountByProjectId: new Map(
          testCaseCounts.map((row) => [row.projectId, row._count._all]),
        ),
        lastRunAtByProjectId: new Map(
          lastRunAts
            .filter(
              (row): row is typeof row & { _max: { startedAt: Date } } =>
                row._max.startedAt !== null,
            )
            .map((row) => [row.projectId, row._max.startedAt]),
        ),
        recentRuns: recentRunRows.map(
          (run): RecentRunRow => ({
            id: run.id,
            projectId: run.projectId,
            projectName: run.project.name,
            suiteId: run.suiteId,
            suiteName: run.suite.name,
            name: run.name,
            status: run.status,
            source: run.source,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            commitSha: run.commitSha,
            commitMessage: run.commitMessage,
            commitAuthor: run.commitAuthor,
            caseCounts: caseCountsByRun.get(run.id) ?? emptyCaseCounts(),
          }),
        ),
      });

      return ok({ ...record, recentActivity });
    } catch (error) {
      if (isUnknownTimeZoneError(error)) return err('invalid-time-zone');
      throw error;
    }
  }
}

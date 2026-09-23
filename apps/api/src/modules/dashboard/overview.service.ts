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
  RECENT_ACTIVITY_CANDIDATE_LIMIT,
  RECENT_ACTIVITY_LIMIT,
  buildRecentActivity,
  type RecentActivityRunRow,
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
  commitSha: string | null;
  runId: string;
  lastActivityAt: Date;
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
            SELECT r.id, r."projectId", r."commitSha", r."startedAt"
              FROM "run" r
             WHERE r."organizationId" = ${organizationId}
               ${runProjectFilter}
             ORDER BY r."startedAt" DESC, r.id DESC
             LIMIT ${RECENT_ACTIVITY_CANDIDATE_LIMIT}
          )
          SELECT "projectId" AS "projectId",
                 MAX("commitSha") AS "commitSha",
                 MAX(id) AS "runId",
                 MAX("startedAt") AS "lastActivityAt"
            FROM activity_candidates
           GROUP BY "projectId", COALESCE("commitSha", id::text)
           ORDER BY "lastActivityAt" DESC
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

      const activityCandidateRows = activityCandidates;
      const activityRuns =
        activityCandidateRows.length === 0
          ? []
          : ((await this.prisma.run.findMany({
              where: {
                organizationId,
                OR: activityCandidateRows.map((candidate) =>
                  candidate.commitSha === null
                    ? { id: candidate.runId }
                    : {
                        projectId: candidate.projectId,
                        commitSha: candidate.commitSha,
                      },
                ),
              },
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
                commitSha: true,
                commitMessage: true,
                commitAuthor: true,
              },
            })) as RecentRunListRow[]);

      const activityCaseGroups =
        activityRuns.length === 0
          ? []
          : await this.prisma.runCase.groupBy({
              by: ['runId', 'status'],
              where: { runId: { in: activityRuns.map((run) => run.id) } },
              _count: { _all: true },
            });
      const caseCountsByActivityRun = buildCaseCountsByRun(activityCaseGroups);

      const recentActivity = buildRecentActivity(
        activityRuns.map(
          (run): RecentActivityRunRow => ({
            id: run.id,
            projectId: run.projectId,
            projectName: run.project.name,
            suiteId: run.suiteId,
            suiteName: run.suite.name,
            name: run.name,
            source: run.source,
            status: run.status,
            startedAt: run.startedAt,
            commitSha: run.commitSha,
            commitMessage: run.commitMessage,
            commitAuthor: run.commitAuthor,
            caseCounts:
              caseCountsByActivityRun.get(run.id) ?? emptyCaseCounts(),
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

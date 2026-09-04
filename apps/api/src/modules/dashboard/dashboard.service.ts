import { Injectable } from '@nestjs/common';
import type {
  CiCommitActivityRecord,
  TraceabilityCalendarRecord,
} from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import {
  RECENT_CI_COMMITS_LIMIT,
  buildCiCommitActivity,
  type CiCommitRunRow,
} from '../../common/metrics/ci-commit-activity';
import {
  DASHBOARD_WINDOW_DAYS,
  RECENT_RUNS_LIMIT,
  computeMetricsWindow,
  computePassRate,
  computePassRateTrend,
  tallyCaseStatuses,
} from '../../common/metrics/run-case-metrics';
import {
  TRACEABILITY_TIME_ZONE,
  buildTraceabilityCalendar,
  type TraceabilityDayCountRow,
} from '../../common/metrics/traceability-calendar';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { RunQueriesService } from '../runs/run-queries.service';
import type {
  DashboardError,
  DashboardSummaryView,
} from './dashboard.contracts';

interface RunScope {
  organizationId: string;
  projectId?: string;
}

function buildScope(org: OrgContext, projectId?: string): RunScope {
  return {
    organizationId: org.organizationId,
    ...(projectId === undefined ? {} : { projectId }),
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runQueries: RunQueriesService,
  ) {}

  private async recentCiCommits(
    scope: RunScope,
  ): Promise<CiCommitActivityRecord[]> {
    const ciScope = { ...scope, source: 'github_actions' as const };

    const recentCommits = await this.prisma.run.groupBy({
      by: ['commitSha'],
      where: { ...ciScope, commitSha: { not: null } },
      _max: { startedAt: true },
      orderBy: { _max: { startedAt: 'desc' } },
      take: RECENT_CI_COMMITS_LIMIT,
    });

    const commitShas = recentCommits
      .map((group) => group.commitSha)
      .filter((sha): sha is string => sha !== null);

    if (commitShas.length === 0) return [];

    const runs = await this.prisma.run.findMany({
      where: { ...ciScope, commitSha: { in: commitShas } },
      select: {
        commitSha: true,
        commitMessage: true,
        commitAuthor: true,
        status: true,
        startedAt: true,
      },
    });

    return buildCiCommitActivity(
      runs.filter((run): run is CiCommitRunRow => run.commitSha !== null),
    );
  }

  private stageCounts(
    dayColumn: Prisma.Sql,
    from: Prisma.Sql,
    scope: Prisma.Sql,
    year: number,
  ): Promise<TraceabilityDayCountRow[]> {
    const zone = TRACEABILITY_TIME_ZONE;

    return this.prisma.$queryRaw<TraceabilityDayCountRow[]>(Prisma.sql`
      SELECT to_char(${dayColumn} AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
        FROM ${from}
       WHERE ${scope}
         AND ${dayColumn} >= (${`${year}-01-01`})::timestamp AT TIME ZONE ${zone}
         AND ${dayColumn} < (${`${year + 1}-01-01`})::timestamp AT TIME ZONE ${zone}
       GROUP BY 1
    `);
  }

  async traceability(
    org: OrgContext,
    year: number,
    projectId?: string,
  ): Promise<Result<TraceabilityCalendarRecord, DashboardError>> {
    if (projectId !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId: org.organizationId },
        select: { id: true },
      });

      if (project === null) return err('project-not-found');
    }

    const organizationId = org.organizationId;
    const scmProject =
      projectId === undefined
        ? Prisma.empty
        : Prisma.sql`AND b."projectId" = ${projectId}`;
    const proposalsProject =
      projectId === undefined
        ? Prisma.empty
        : Prisma.sql`AND ep."projectId" = ${projectId}`;
    const officialProject =
      projectId === undefined
        ? Prisma.empty
        : Prisma.sql`AND s."projectId" = ${projectId}`;
    const runsProject =
      projectId === undefined
        ? Prisma.empty
        : Prisma.sql`AND r."projectId" = ${projectId}`;

    const [scm, proposals, official, runs] = await Promise.all([
      this.stageCounts(
        Prisma.sql`b."createdAt"`,
        Prisma.sql`"ingestion_batch" b JOIN "project" p ON p."id" = b."projectId"`,
        Prisma.sql`p."organizationId" = ${organizationId} ${scmProject}`,
        year,
      ),
      this.stageCounts(
        Prisma.sql`ep."createdAt"`,
        Prisma.sql`"extracted_proposal" ep JOIN "project" p ON p."id" = ep."projectId"`,
        Prisma.sql`p."organizationId" = ${organizationId} ${proposalsProject}`,
        year,
      ),
      this.stageCounts(
        Prisma.sql`tc."createdAt"`,
        Prisma.sql`"test_case" tc JOIN "suite" s ON s."id" = tc."suiteId"`,
        Prisma.sql`s."organizationId" = ${organizationId} ${officialProject}`,
        year,
      ),
      this.stageCounts(
        Prisma.sql`r."startedAt"`,
        Prisma.sql`"run" r`,
        Prisma.sql`r."organizationId" = ${organizationId} ${runsProject}`,
        year,
      ),
    ]);

    return ok(
      buildTraceabilityCalendar(year, { scm, proposals, official, runs }),
    );
  }

  async summary(
    org: OrgContext,
    projectId?: string,
  ): Promise<Result<DashboardSummaryView, DashboardError>> {
    if (projectId !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId: org.organizationId },
        select: { id: true },
      });

      if (project === null) return err('project-not-found');
    }

    const scope = buildScope(org, projectId);
    const window = computeMetricsWindow(new Date());

    const [
      totalProjects,
      totalSuites,
      totalRuns,
      runsInWindow,
      activeRuns,
      currentGroups,
      previousGroups,
      runSummaries,
      recentCiCommits,
    ] = await Promise.all([
      projectId === undefined
        ? this.prisma.project.count({
            where: { organizationId: org.organizationId },
          })
        : Promise.resolve(1),
      this.prisma.suite.count({ where: scope }),
      this.prisma.run.count({ where: scope }),
      this.prisma.run.count({
        where: {
          ...scope,
          startedAt: { gte: window.currentStart, lte: window.currentEnd },
        },
      }),
      this.prisma.run.count({ where: { ...scope, status: 'running' } }),
      this.prisma.runCase.groupBy({
        by: ['status'],
        where: {
          run: {
            ...scope,
            startedAt: { gte: window.currentStart, lte: window.currentEnd },
          },
        },
        _count: { _all: true },
      }),
      this.prisma.runCase.groupBy({
        by: ['status'],
        where: {
          run: {
            ...scope,
            startedAt: { gte: window.previousStart, lt: window.previousEnd },
          },
        },
        _count: { _all: true },
      }),
      this.runQueries.list(org, projectId),
      this.recentCiCommits(scope),
    ]);

    const currentCounts = tallyCaseStatuses(currentGroups);
    const previousCounts = tallyCaseStatuses(previousGroups);
    const passRate = computePassRate(currentCounts);
    const passRateTrend = computePassRateTrend(
      passRate,
      computePassRate(previousCounts),
    );

    return ok({
      totalProjects,
      totalSuites,
      totalRuns,
      runsInWindow,
      activeRuns,
      passRate,
      passRateTrend,
      defectsDetected: currentCounts.fail,
      windowDays: DASHBOARD_WINDOW_DAYS,
      recentRuns: runSummaries.slice(0, RECENT_RUNS_LIMIT),
      recentCiCommits,
    });
  }
}

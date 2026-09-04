import { Injectable } from '@nestjs/common';
import type { CiCommitActivityRecord } from '@qably/types';
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

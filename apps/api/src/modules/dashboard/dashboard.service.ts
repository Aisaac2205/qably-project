import { Injectable } from '@nestjs/common';
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
      recentCiRuns: runSummaries
        .filter((run) => run.source === 'github_actions')
        .slice(0, RECENT_RUNS_LIMIT),
    });
  }
}

import { Injectable } from '@nestjs/common';
import type {
  CaseStatus,
  ProjectActivity,
  RunCaseCounts,
  RunStatus,
} from '@qably/types';
import {
  buildCaseCountsByRun,
  computeHealthScore,
  computeMetricsWindow,
  emptyCaseCounts,
  sumCaseCounts,
} from '../../common/metrics/run-case-metrics';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ProjectError,
  ProjectListView,
  ProjectView,
} from './projects.contracts';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from './projects.schemas';

const UNIQUE_VIOLATION = 'P2002';

const SELECT = {
  id: true,
  name: true,
  description: true,
  connectionId: true,
  connection: { select: { repo: true } },
  organizationId: true,
  technologies: true,
  createdAt: true,
  updatedAt: true,
} as const;

const LIST_SELECT = {
  ...SELECT,
  _count: { select: { suites: true } },
} as const;

interface ProjectListRow extends ProjectRow {
  _count?: { suites: number };
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  connectionId: string | null;
  connection: { repo: string } | null;
  organizationId: string;
  technologies: string[];
  createdAt: Date;
  updatedAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function toListView(
  row: ProjectListRow,
  activity: ProjectActivity | null,
): ProjectListView {
  return {
    ...toView(row),
    suiteCount: row._count?.suites ?? 0,
    activity,
  };
}

function toView(row: ProjectRow): ProjectView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    connectionId: row.connectionId ?? undefined,
    githubRepo: row.connection?.repo ?? undefined,
    organizationId: row.organizationId,
    technologies: row.technologies,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function canDelete(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(org: OrgContext): Promise<ProjectListView[]> {
    const rows = await this.prisma.project.findMany({
      where: { organizationId: org.organizationId },
      orderBy: { createdAt: 'desc' },
      select: LIST_SELECT,
    });

    if (rows.length === 0) return [];

    const activityByProject = await this.loadActivity(
      org,
      rows.map((row) => row.id),
    );

    return rows.map((row) =>
      toListView(row, activityByProject.get(row.id) ?? null),
    );
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<ProjectView, ProjectError>> {
    const row = await this.prisma.project.findFirst({
      where: { id, organizationId: org.organizationId },
      select: SELECT,
    });

    return row === null ? err('not-found') : ok(toView(row));
  }

  async create(
    org: OrgContext,
    input: CreateProjectInput,
  ): Promise<Result<ProjectView, ProjectError>> {
    const withinAllowance = await this.hasProjectAllowance(org);

    if (!withinAllowance) return err('plan-limit-reached');

    if (!(await this.connectionIsUsable(org, input.connectionId))) {
      return err('connection-not-found');
    }

    try {
      const row = await this.prisma.project.create({
        data: { ...input, organizationId: org.organizationId },
        select: SELECT,
      });

      return ok(toView(row));
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      throw error;
    }
  }

  async update(
    org: OrgContext,
    id: string,
    input: UpdateProjectInput,
  ): Promise<Result<ProjectView, ProjectError>> {
    const scoped = await this.prisma.project.findFirst({
      where: { id, organizationId: org.organizationId },
      select: { id: true },
    });

    if (scoped === null) return err('not-found');

    if (!(await this.connectionIsUsable(org, input.connectionId))) {
      return err('connection-not-found');
    }

    try {
      const row = await this.prisma.project.update({
        where: { id },
        data: input,
        select: SELECT,
      });

      return ok(toView(row));
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      throw error;
    }
  }

  async remove(
    org: OrgContext,
    id: string,
  ): Promise<Result<void, ProjectError>> {
    if (!canDelete(org)) return err('forbidden');

    const scoped = await this.prisma.project.findFirst({
      where: { id, organizationId: org.organizationId },
      select: { id: true },
    });

    if (scoped === null) return err('not-found');

    await this.prisma.project.delete({ where: { id } });

    return ok(undefined);
  }

  private async connectionIsUsable(
    org: OrgContext,
    connectionId: string | null | undefined,
  ): Promise<boolean> {
    if (connectionId === undefined || connectionId === null) return true;

    const connection = await this.prisma.connection.findFirst({
      where: { id: connectionId, organizationId: org.organizationId },
      select: { id: true },
    });

    return connection !== null;
  }

  private async loadActivity(
    org: OrgContext,
    projectIds: string[],
  ): Promise<Map<string, ProjectActivity>> {
    const window = computeMetricsWindow(new Date());

    const [lastRunRows, activeGroupRows, windowRunRows] = await Promise.all([
      this.prisma.run.findMany({
        where: {
          projectId: { in: projectIds },
          organizationId: org.organizationId,
        },
        orderBy: { startedAt: 'desc' },
        distinct: ['projectId'],
        select: { projectId: true, status: true, startedAt: true },
      }),
      this.prisma.run.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          organizationId: org.organizationId,
          status: 'running',
        },
        _count: { _all: true },
      }),
      this.prisma.run.findMany({
        where: {
          projectId: { in: projectIds },
          organizationId: org.organizationId,
          startedAt: { gte: window.currentStart, lte: window.currentEnd },
        },
        select: { id: true, projectId: true },
      }),
    ]);

    const lastRuns = lastRunRows as {
      projectId: string;
      status: RunStatus;
      startedAt: Date;
    }[];
    const activeGroups = activeGroupRows as {
      projectId: string;
      _count: { _all: number };
    }[];
    const windowRuns = windowRunRows as { id: string; projectId: string }[];

    const caseGroupRows =
      windowRuns.length === 0
        ? []
        : await this.prisma.runCase.groupBy({
            by: ['runId', 'status'],
            where: { runId: { in: windowRuns.map((run) => run.id) } },
            _count: { _all: true },
          });
    const caseGroups = caseGroupRows as {
      runId: string;
      status: CaseStatus;
      _count: { _all: number };
    }[];

    const countsByRun = buildCaseCountsByRun(caseGroups);
    const activeCountByProject = new Map(
      activeGroups.map((group) => [group.projectId, group._count._all]),
    );
    const countsByProject = new Map<string, RunCaseCounts[]>();

    for (const run of windowRuns) {
      const counts = countsByRun.get(run.id) ?? emptyCaseCounts();
      const existing = countsByProject.get(run.projectId) ?? [];
      countsByProject.set(run.projectId, [...existing, counts]);
    }

    const activityByProject = new Map<string, ProjectActivity>();

    for (const lastRun of lastRuns) {
      const projectCounts = sumCaseCounts(
        countsByProject.get(lastRun.projectId) ?? [],
      );

      activityByProject.set(lastRun.projectId, {
        healthScore: computeHealthScore(projectCounts),
        lastRunStatus: lastRun.status,
        lastRunAt: lastRun.startedAt.toISOString(),
        activeRunCount: activeCountByProject.get(lastRun.projectId) ?? 0,
      });
    }

    return activityByProject;
  }

  private async hasProjectAllowance(org: OrgContext): Promise<boolean> {
    const [{ maxProjects }, used] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: org.organizationId },
        select: { maxProjects: true },
      }),
      this.prisma.project.count({
        where: { organizationId: org.organizationId },
      }),
    ]);

    return used < maxProjects;
  }
}

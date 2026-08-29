import { Injectable } from '@nestjs/common';
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
  githubRepo: true,
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
  githubRepo: string | null;
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

function toListView(row: ProjectListRow): ProjectListView {
  return {
    ...toView(row),
    suiteCount: row._count?.suites ?? 0,
    activity: null,
  };
}

function toView(row: ProjectRow): ProjectView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    githubRepo: row.githubRepo ?? undefined,
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

    return rows.map(toListView);
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

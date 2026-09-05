import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { SuiteError, SuiteView } from './suites.contracts';
import type {
  CreateCaseInput,
  CreateSuiteInput,
  UpdateCaseInput,
  UpdateSuiteInput,
} from './suites.schemas';

const UNIQUE_VIOLATION = 'P2002';

const CASE_SELECT = {
  id: true,
  suiteId: true,
  name: true,
  steps: true,
  expectedResult: true,
  priority: true,
  state: true,
  currentVersion: { select: { version: true } },
} as const;

const SUITE_SELECT = {
  id: true,
  projectId: true,
  organizationId: true,
  name: true,
  description: true,
  tags: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
  cases: { select: CASE_SELECT, orderBy: { position: 'asc' } },
} as const;

interface CaseRow {
  id: string;
  suiteId: string;
  name: string;
  steps: string[];
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  state: 'active' | 'draft' | 'deprecated';
  currentVersion: { version: number } | null;
}

interface SuiteRow {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  cases: CaseRow[];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function toView(row: SuiteRow): SuiteView {
  return {
    id: row.id,
    projectId: row.projectId,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    tags: row.tags,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cases: row.cases.map((testCase) => ({
      id: testCase.id,
      suiteId: testCase.suiteId,
      version: testCase.currentVersion?.version ?? 1,
      name: testCase.name,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult,
      priority: testCase.priority,
      state: testCase.state,
    })),
  };
}

function canWrite(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

@Injectable()
export class SuitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(org: OrgContext, projectId?: string): Promise<SuiteView[]> {
    const rows = await this.prisma.suite.findMany({
      where: {
        organizationId: org.organizationId,
        ...(projectId === undefined ? {} : { projectId }),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: SUITE_SELECT,
    });

    return rows.map(toView);
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<SuiteView, SuiteError>> {
    const row = await this.scoped(org, id);

    return row === null ? err('not-found') : ok(toView(row));
  }

  async create(
    org: OrgContext,
    input: CreateSuiteInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org.organizationId },
      select: { id: true },
    });

    if (project === null) return err('not-found');

    const { isDefault, ...rest } = input;

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (isDefault) await this.clearDefault(tx, input.projectId);

        return tx.suite.create({
          data: { ...rest, isDefault, organizationId: org.organizationId },
          select: SUITE_SELECT,
        });
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
    input: UpdateSuiteInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault === true) {
          await this.clearDefault(tx, existing.projectId, id);
        }

        return tx.suite.update({
          where: { id },
          data: input,
          select: SUITE_SELECT,
        });
      });

      return ok(toView(row));
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      throw error;
    }
  }

  async remove(org: OrgContext, id: string): Promise<Result<void, SuiteError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    await this.prisma.suite.delete({ where: { id } });

    return ok(undefined);
  }

  async addCase(
    org: OrgContext,
    suiteId: string,
    input: CreateCaseInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.testCase.create({
        data: {
          ...input,
          suiteId,
          projectId: existing.projectId,
          position: existing.cases.length,
        },
      });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    return ok(toView(row));
  }

  async updateCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
    input: UpdateCaseInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');
    if (!existing.cases.some((testCase) => testCase.id === caseId)) {
      return err('not-found');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.testCase.update({ where: { id: caseId }, data: input });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    return ok(toView(row));
  }

  async removeCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');
    if (!existing.cases.some((testCase) => testCase.id === caseId)) {
      return err('not-found');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.testCase.delete({ where: { id: caseId } });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    return ok(toView(row));
  }

  private scoped(org: OrgContext, id: string): Promise<SuiteRow | null> {
    return this.prisma.suite.findFirst({
      where: { id, organizationId: org.organizationId },
      select: SUITE_SELECT,
    });
  }

  private async clearDefault(
    tx: { suite: { updateMany: PrismaService['suite']['updateMany'] } },
    projectId: string,
    exceptId?: string,
  ): Promise<void> {
    await tx.suite.updateMany({
      where: {
        projectId,
        isDefault: true,
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      data: { isDefault: false },
    });
  }
}

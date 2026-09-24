import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { SUITE_SELECT, toView, type SuiteRow } from './lib/suite-view';
import { SuiteViewAssembler } from './suite-view.assembler';
import type {
  ConfirmDocumentationResult,
  SuiteError,
  SuiteView,
} from './suites.contracts';
import type { CreateSuiteInput, UpdateSuiteInput } from './suites.schemas';

function canWrite(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}
@Injectable()
export class SuitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suiteViewAssembler: SuiteViewAssembler,
  ) {}

  async list(org: OrgContext, projectId?: string): Promise<SuiteView[]> {
    const [rows, orgDefaultLocale] = await Promise.all([
      this.prisma.suite.findMany({
        where: {
          organizationId: org.organizationId,
          ...(projectId === undefined ? {} : { projectId }),
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: SUITE_SELECT,
      }),
      resolveOrgDefaultLocale(this.prisma, org.organizationId),
    ]);

    return this.suiteViewAssembler.withLastResults(
      rows.map((row) => toView(row, orgDefaultLocale)),
      rows,
      orgDefaultLocale,
    );
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<SuiteView, SuiteError>> {
    const row = await this.scoped(org, id);

    if (row === null) return err('not-found');

    const orgDefaultLocale = await resolveOrgDefaultLocale(
      this.prisma,
      org.organizationId,
    );

    return ok(
      await this.suiteViewAssembler.withLastResult(
        toView(row, orgDefaultLocale),
        row,
        orgDefaultLocale,
      ),
    );
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

      const orgDefaultLocale = await resolveOrgDefaultLocale(
        this.prisma,
        org.organizationId,
      );

      return ok(
        await this.suiteViewAssembler.withLastResult(
          toView(row, orgDefaultLocale),
          row,
          orgDefaultLocale,
        ),
      );
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
        const currentName = await this.lockSuiteName(tx, id, existing.name);

        if (input.isDefault === true) {
          await this.clearDefault(tx, existing.projectId, id);
        }

        return tx.suite.update({
          where: { id },
          data: {
            ...input,
            ...(input.name === undefined || input.name === currentName
              ? {}
              : { nameSource: 'human' }),
          },
          select: SUITE_SELECT,
        });
      });

      const orgDefaultLocale = await resolveOrgDefaultLocale(
        this.prisma,
        org.organizationId,
      );

      return ok(
        await this.suiteViewAssembler.withLastResult(
          toView(row, orgDefaultLocale),
          row,
          orgDefaultLocale,
        ),
      );
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

  async confirmDocumentation(
    org: OrgContext,
    suiteId: string,
    actorId: string,
    caseIds?: string[],
  ): Promise<Result<ConfirmDocumentationResult, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');
    if (!canWrite(org)) return err('forbidden');

    const confirmedAt = new Date();

    const { confirmedCaseIds, skippedCaseIds } = await this.prisma.$transaction(
      async (tx) => {
        const candidates = await tx.testCase.findMany({
          where: {
            suiteId,
            executionMode: 'automated',
            state: 'draft',
            ...(caseIds !== undefined && { id: { in: caseIds } }),
          },
          select: { id: true, currentVersionId: true },
        });

        const confirmed = candidates.filter(
          (candidate) => candidate.currentVersionId !== null,
        );
        const skipped = candidates.filter(
          (candidate) => candidate.currentVersionId === null,
        );

        if (confirmed.length > 0) {
          await tx.testCase.updateMany({
            where: { id: { in: confirmed.map((candidate) => candidate.id) } },
            data: { state: 'active' },
          });
        }

        const remaining =
          caseIds === undefined
            ? skipped.length
            : await tx.testCase.count({
                where: {
                  suiteId,
                  executionMode: 'automated',
                  state: 'draft',
                },
              });

        if (remaining === 0) {
          await tx.suite.update({
            where: { id: suiteId },
            data: {
              documentationConfirmedAt: confirmedAt,
              documentationConfirmedById: actorId,
            },
          });
        }

        return {
          confirmedCaseIds: confirmed.map((candidate) => candidate.id),
          skippedCaseIds: skipped.map((candidate) => candidate.id),
        };
      },
    );

    return ok({
      suiteId,
      confirmedCaseIds,
      confirmedCount: confirmedCaseIds.length,
      skippedCaseIds,
      skippedCount: skippedCaseIds.length,
      documentationConfirmedAt: confirmedAt.toISOString(),
      documentationConfirmedById: actorId,
    });
  }

  private scoped(org: OrgContext, id: string): Promise<SuiteRow | null> {
    return this.prisma.suite.findFirst({
      where: { id, organizationId: org.organizationId },
      select: SUITE_SELECT,
    });
  }

  private async lockSuiteName(
    tx: { $queryRaw: PrismaService['$queryRaw'] },
    id: string,
    fallback: string,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ name: string }[]>(
      Prisma.sql`SELECT name FROM "suite" WHERE id = ${id} FOR UPDATE`,
    );

    return rows[0]?.name ?? fallback;
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

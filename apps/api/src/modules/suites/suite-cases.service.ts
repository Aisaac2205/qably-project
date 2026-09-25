import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import { SUITE_SELECT, toView, type SuiteRow } from './lib/suite-view';
import { SuiteViewAssembler } from './suite-view.assembler';
import type { SuiteError, SuiteView } from './suites.contracts';
import type { CreateCaseInput, UpdateCaseInput } from './suites.schemas';

interface DocumentedCaseFields {
  name: string;
  steps: string[];
  expectedResult: string;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function documentedFieldsChanged(
  input: UpdateCaseInput,
  current: DocumentedCaseFields,
): boolean {
  return (
    (input.name !== undefined && input.name !== current.name) ||
    (input.steps !== undefined && !arraysEqual(input.steps, current.steps)) ||
    (input.expectedResult !== undefined &&
      input.expectedResult !== current.expectedResult)
  );
}

@Injectable()
export class SuiteCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suiteViewAssembler: SuiteViewAssembler,
    private readonly reclassifier: ProposalReclassifier,
  ) {}

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

    await this.reclassifier.enqueue(suiteId);

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

  async updateCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
    input: UpdateCaseInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');
    const currentCase = existing.cases.find(
      (testCase) => testCase.id === caseId,
    );
    if (currentCase === undefined) return err('not-found');

    let identityFieldsChanged = false;

    const row = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockCaseDocumentedFields(
        tx,
        caseId,
        currentCase,
      );
      identityFieldsChanged = documentedFieldsChanged(input, locked);

      await tx.testCase.update({
        where: { id: caseId },
        data: {
          ...input,
          ...(identityFieldsChanged ? { documentationSource: 'human' } : {}),
        },
      });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    if (identityFieldsChanged) {
      await this.reclassifier.enqueue(suiteId);
    }

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

  private scoped(org: OrgContext, id: string): Promise<SuiteRow | null> {
    return this.prisma.suite.findFirst({
      where: { id, organizationId: org.organizationId },
      select: SUITE_SELECT,
    });
  }

  private async lockCaseDocumentedFields(
    tx: { $queryRaw: PrismaService['$queryRaw'] },
    id: string,
    fallback: DocumentedCaseFields,
  ): Promise<DocumentedCaseFields> {
    const rows = await tx.$queryRaw<DocumentedCaseFields[]>(
      Prisma.sql`SELECT name, steps, "expectedResult" FROM "test_case" WHERE id = ${id} FOR UPDATE`,
    );

    return rows[0] ?? fallback;
  }
}

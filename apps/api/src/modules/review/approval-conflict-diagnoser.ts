import { Injectable, Logger } from '@nestjs/common';
import type {
  ReviewApprovalConflictCode,
  ReviewConflictingCase,
} from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import {
  testCaseUniqueConstraint,
  type TestCaseUniqueConstraint,
} from './lib/test-case-unique-constraint';
import type { ApprovalConflict } from './review.contracts';

const CONFLICT_CODES: Readonly<
  Record<TestCaseUniqueConstraint, ReviewApprovalConflictCode>
> = {
  name: 'name-taken',
  automationKey: 'automation-key-taken',
  unknown: 'publish-conflict',
};

export interface ConflictedProposal {
  readonly id: string;
  readonly title: string;
  readonly automationKey: string | null;
  readonly targetTestCaseId: string | null;
  readonly suiteId: string | null;
  readonly targetTestCase: { readonly suiteId: string } | null;
}

@Injectable()
export class ApprovalConflictDiagnoser {
  private readonly logger = new Logger(ApprovalConflictDiagnoser.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reclassifier: ProposalReclassifier,
  ) {}

  async diagnose(
    org: OrgContext,
    proposal: ConflictedProposal,
    newCaseSuiteId: string | null,
    error: unknown,
  ): Promise<ApprovalConflict> {
    const constraint = testCaseUniqueConstraint(error);
    const suiteId =
      newCaseSuiteId ??
      proposal.targetTestCase?.suiteId ??
      proposal.suiteId ??
      null;
    const conflictingCase = await this.findConflictingCase(
      org,
      proposal,
      suiteId,
      constraint,
    );

    this.logger.warn(
      `Approval blocked by a unique constraint: proposal=${proposal.id} suite=${suiteId ?? 'unknown'} constraint=${constraint} conflictingCase=${conflictingCase?.id ?? 'none'}`,
    );

    if (
      constraint === 'automationKey' &&
      proposal.targetTestCaseId === null &&
      suiteId !== null
    ) {
      await this.reclassifier.enqueue(suiteId);
    }

    return { code: CONFLICT_CODES[constraint], conflictingCase };
  }

  private async findConflictingCase(
    org: OrgContext,
    proposal: ConflictedProposal,
    suiteId: string | null,
    constraint: TestCaseUniqueConstraint,
  ): Promise<ReviewConflictingCase | null> {
    if (suiteId === null || constraint === 'unknown') return null;
    if (constraint === 'automationKey' && proposal.automationKey === null) {
      return null;
    }

    try {
      return await this.prisma.testCase.findFirst({
        where: {
          suiteId,
          project: { organizationId: org.organizationId },
          ...(proposal.targetTestCaseId === null
            ? {}
            : { id: { not: proposal.targetTestCaseId } }),
          ...(constraint === 'name'
            ? { name: proposal.title }
            : { automationKey: proposal.automationKey as string }),
        },
        select: { id: true, name: true, suiteId: true },
      });
    } catch {
      this.logger.warn(
        `Conflicting case lookup failed: proposal=${proposal.id} suite=${suiteId}`,
      );
      return null;
    }
  }
}

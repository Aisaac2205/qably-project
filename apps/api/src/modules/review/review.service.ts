import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApprovalView,
  DecisionInput,
  RejectionView,
  ReviewError,
} from './review.contracts';

const PENDING_STATUS = 'in_review';

const PROPOSAL_SELECT = {
  id: true,
  projectId: true,
  status: true,
  title: true,
  objective: true,
  preconditions: true,
  steps: true,
  expectedResult: true,
  priority: true,
  evidenceId: true,
  targetTestCaseId: true,
  evidence: { select: { id: true } },
} as const;

interface ProposalRow {
  id: string;
  projectId: string;
  status: string;
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidenceId: string;
  targetTestCaseId: string | null;
  evidence: { id: string } | null;
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async approve(
    org: OrgContext,
    proposalId: string,
    input: DecisionInput,
  ): Promise<Result<ApprovalView, ReviewError>> {
    const proposal = await this.pending(org, proposalId);

    if (!proposal.ok) return proposal;
    if (proposal.value.evidence === null) return err('missing-evidence');

    const target = proposal.value.targetTestCaseId;
    const suiteId =
      target === null ? await this.suiteFor(proposal.value) : null;

    if (target === null && suiteId === null) return err('missing-suite');

    return ok(await this.publish(proposal.value, suiteId, input));
  }

  async reject(
    org: OrgContext,
    proposalId: string,
    input: DecisionInput,
  ): Promise<Result<RejectionView, ReviewError>> {
    const proposal = await this.pending(org, proposalId);

    if (!proposal.ok) return proposal;

    const decisionId = await this.prisma.$transaction(async (tx) => {
      const decision = await tx.reviewDecision.create({
        data: {
          proposalId: proposal.value.id,
          actorId: input.actorId,
          action: 'rejected',
          ...(input.comment === undefined ? {} : { comment: input.comment }),
        },
        select: { id: true },
      });

      await tx.extractedProposal.update({
        where: { id: proposal.value.id },
        data: { status: 'rejected' },
      });

      return decision.id;
    });

    return ok({ decisionId });
  }

  private async pending(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<ProposalRow, ReviewError>> {
    const row = (await this.prisma.extractedProposal.findFirst({
      where: {
        id: proposalId,
        project: { organizationId: org.organizationId },
      },
      select: PROPOSAL_SELECT,
    })) as ProposalRow | null;

    if (row === null) return err('not-found');
    if (row.status !== PENDING_STATUS) return err('invalid-transition');

    return ok(row);
  }

  private async suiteFor(proposal: ProposalRow): Promise<string | null> {
    const suite = await this.prisma.suite.findFirst({
      where: { projectId: proposal.projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    return suite === null ? null : suite.id;
  }

  private publish(
    proposal: ProposalRow,
    suiteId: string | null,
    input: DecisionInput,
  ): Promise<ApprovalView> {
    return this.prisma.$transaction(async (tx) => {
      const createdNewCase = proposal.targetTestCaseId === null;
      const testCaseId = createdNewCase
        ? (
            await tx.testCase.create({
              data: {
                projectId: proposal.projectId,
                suiteId: suiteId as string,
                name: proposal.title,
                steps: proposal.steps,
                expectedResult: proposal.expectedResult,
                priority: proposal.priority,
              },
              select: { id: true },
            })
          ).id
        : (proposal.targetTestCaseId as string);

      const published = await tx.testCaseVersion.count({
        where: { testCaseId },
      });

      const version = await tx.testCaseVersion.create({
        data: {
          testCaseId,
          version: published + 1,
          title: proposal.title,
          objective: proposal.objective,
          preconditions: proposal.preconditions,
          steps: proposal.steps,
          expectedResult: proposal.expectedResult,
          priority: proposal.priority,
        },
        select: { id: true, version: true },
      });

      await tx.testCase.update({
        where: { id: testCaseId },
        data: { currentVersionId: version.id },
      });

      await tx.traceabilityLink.createMany({
        data: [
          {
            projectId: proposal.projectId,
            fromType: 'proposal',
            fromId: proposal.id,
            toType: 'test_case',
            toId: testCaseId,
            relation: 'produced',
          },
          {
            projectId: proposal.projectId,
            fromType: 'test_case_version',
            fromId: version.id,
            toType: 'test_case',
            toId: testCaseId,
            relation: 'version_of',
          },
        ],
        skipDuplicates: true,
      });

      const decision = await tx.reviewDecision.create({
        data: {
          proposalId: proposal.id,
          actorId: input.actorId,
          action: 'approved',
          ...(input.comment === undefined ? {} : { comment: input.comment }),
        },
        select: { id: true },
      });

      await tx.extractedProposal.update({
        where: { id: proposal.id },
        data: { status: 'approved' },
      });

      return {
        createdNewCase,
        testCaseId,
        versionId: version.id,
        version: version.version,
        decisionId: decision.id,
      };
    });
  }
}

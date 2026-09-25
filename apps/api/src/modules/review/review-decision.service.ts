import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import type {
  ApprovalView,
  DecisionInput,
  LastDecisionView,
  RejectionView,
  ReviewError,
} from './review.contracts';
import { publishTestCaseVersion } from './lib/publish-test-case-version';

const PENDING_STATUS = 'in_review';

class DecisionConflict extends Error {
  constructor() {
    super('proposal is no longer in_review');
  }
}

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
  suiteId: true,
  automationKey: true,
  locale: true,
  evidence: { select: { id: true } },
  codeChange: { select: { filePath: true } },
  targetTestCase: { select: { automationFilePath: true } },
} as const;

interface ProposalRow {
  id: string;
  projectId: string;
  status: string;
  locale?: string | null;
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidenceId: string;
  targetTestCaseId: string | null;
  suiteId: string | null;
  automationKey: string | null;
  evidence: { id: string } | null;
  codeChange: { filePath: string } | null;
  targetTestCase: { automationFilePath: string | null } | null;
}

function automationFieldsFor(proposal: ProposalRow): Record<string, string> {
  if (proposal.automationKey === null) return {};

  const automationFilePath =
    proposal.codeChange?.filePath ??
    proposal.targetTestCase?.automationFilePath ??
    null;

  return {
    executionMode: 'automated',
    automationKey: proposal.automationKey,
    ...(automationFilePath === null ? {} : { automationFilePath }),
  };
}

@Injectable()
export class ReviewDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reclassifier: ProposalReclassifier,
  ) {}

  async approve(
    org: OrgContext,
    proposalId: string,
    input: DecisionInput,
  ): Promise<Result<ApprovalView, ReviewError>> {
    const proposal = await this.pending(org, proposalId);

    if (!proposal.ok) return proposal;
    if (proposal.value.evidence === null) return err('missing-evidence');
    if (proposal.value.steps.length === 0) return err('incomplete-proposal');

    const target = proposal.value.targetTestCaseId;
    const suiteId =
      target === null
        ? (proposal.value.suiteId ?? (await this.suiteFor(proposal.value)))
        : null;

    if (target === null && suiteId === null) return err('missing-suite');

    try {
      const approval = await this.publish(proposal.value, suiteId, input);
      await this.reclassifier.enqueue(approval.suiteId);
      return ok(approval);
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      if (error instanceof DecisionConflict) return err('invalid-transition');
      throw error;
    }
  }

  async reject(
    org: OrgContext,
    proposalId: string,
    input: DecisionInput,
  ): Promise<Result<RejectionView, ReviewError>> {
    const proposal = await this.pending(org, proposalId);

    if (!proposal.ok) return proposal;

    try {
      const decisionId = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.extractedProposal.updateMany({
          where: { id: proposal.value.id, status: PENDING_STATUS },
          data: { status: 'rejected' },
        });
        if (claim.count === 0) throw new DecisionConflict();

        const decision = await tx.reviewDecision.create({
          data: {
            proposalId: proposal.value.id,
            actorId: input.actorId,
            action: 'rejected',
            ...(input.comment === undefined ? {} : { comment: input.comment }),
          },
          select: { id: true },
        });

        return decision.id;
      });

      return ok({ decisionId });
    } catch (error) {
      if (error instanceof DecisionConflict) return err('invalid-transition');
      throw error;
    }
  }

  async lastDecision(
    org: OrgContext,
    proposalId: string,
  ): Promise<LastDecisionView | null> {
    const decision = await this.prisma.reviewDecision.findFirst({
      where: {
        proposalId,
        proposal: { project: { organizationId: org.organizationId } },
      },
      orderBy: { decidedAt: 'desc' },
      select: {
        action: true,
        decidedAt: true,
        actor: { select: { id: true, name: true } },
      },
    });

    if (decision === null) return null;

    return {
      action: decision.action,
      decidedAt: decision.decidedAt.toISOString(),
      decidedBy: { id: decision.actor.id, name: decision.actor.name },
    };
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
      const claim = await tx.extractedProposal.updateMany({
        where: { id: proposal.id, status: PENDING_STATUS },
        data: { status: 'approved' },
      });
      if (claim.count === 0) throw new DecisionConflict();

      const createdNewCase = proposal.targetTestCaseId === null;
      const automationFields = automationFieldsFor(proposal);
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
                state: 'active',
                ...automationFields,
              },
              select: { id: true },
            })
          ).id
        : (proposal.targetTestCaseId as string);

      const version = await publishTestCaseVersion(
        tx,
        testCaseId,
        {
          title: proposal.title,
          objective: proposal.objective,
          preconditions: proposal.preconditions,
          steps: proposal.steps,
          expectedResult: proposal.expectedResult,
          priority: proposal.priority,
          locale: proposal.locale ?? null,
        },
        { priority: proposal.priority, state: 'active', ...automationFields },
      );

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

      return {
        createdNewCase,
        testCaseId,
        testCaseName: proposal.title,
        suiteId: createdNewCase ? suiteId : (proposal.suiteId ?? null),
        versionId: version.id,
        version: version.version,
        decisionId: decision.id,
      };
    });
  }
}

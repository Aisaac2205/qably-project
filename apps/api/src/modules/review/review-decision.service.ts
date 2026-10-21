import { Injectable } from '@nestjs/common';
import { assessCaseDocumentation } from '@qably/types';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { DomainEvents } from '../../common/events/domain-events.service';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalConflictDiagnoser } from './approval-conflict-diagnoser';
import type {
  ApplyTo,
  ApprovalError,
  ApprovalInput,
  ApprovalView,
  DecisionInput,
  LastDecisionView,
  RejectionView,
  ReviewError,
} from './review.contracts';
import { lockTestCaseForUpdate } from './lib/lock-test-case';
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
  targetTestCase: { select: { automationFilePath: true, suiteId: true } },
  duplicateKind: true,
  matchedCase: {
    select: {
      id: true,
      projectId: true,
      suiteId: true,
      automationFilePath: true,
    },
  },
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
  targetTestCase: {
    automationFilePath: string | null;
    suiteId: string;
  } | null;
  duplicateKind: string | null;
  matchedCase: {
    id: string;
    projectId: string;
    suiteId: string;
    automationFilePath: string | null;
  } | null;
}

function toDecidedAction(action: string): 'approved' | 'rejected' {
  if (action === 'approved' || action === 'rejected') return action;
  throw new Error(`Unexpected review decision action: ${action}`);
}

/**
 * Resolves the reviewer's choice into the proposal the rest of the approval
 * works on. Applying a possible duplicate to its matched case is the same as
 * approving an update, so the proposal is pointed at that case. Anything the
 * proposal cannot honour is refused instead of silently creating a case.
 */
function applyChoice(
  proposal: ProposalRow,
  applyTo: ApplyTo | undefined,
): Result<ProposalRow, 'invalid-apply-target'> {
  if (applyTo === undefined) return ok(proposal);
  if (proposal.targetTestCaseId !== null) return err('invalid-apply-target');
  if (applyTo === 'new-case') return ok(proposal);

  const matched = proposal.matchedCase;

  if (
    proposal.duplicateKind !== 'possible_duplicate' ||
    matched === null ||
    matched.projectId !== proposal.projectId
  ) {
    return err('invalid-apply-target');
  }

  return ok({
    ...proposal,
    targetTestCaseId: matched.id,
    suiteId: matched.suiteId,
    targetTestCase: {
      automationFilePath: matched.automationFilePath,
      suiteId: matched.suiteId,
    },
  });
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

function documentedStateFor(proposal: ProposalRow): {
  documentationOutcome: 'complete' | 'incomplete';
  documentationMissing: string[];
  documentationOutcomeAt: Date;
  documentationQueuedAt: null;
  documentationSkipReason: null;
} {
  const assessment = assessCaseDocumentation({
    name: proposal.title,
    automationKey: proposal.automationKey,
    objective: proposal.objective,
    steps: proposal.steps,
    expectedResult: proposal.expectedResult,
  });

  return {
    documentationOutcome: assessment.complete ? 'complete' : 'incomplete',
    documentationMissing: assessment.missing,
    documentationOutcomeAt: new Date(),
    documentationQueuedAt: null,
    documentationSkipReason: null,
  };
}

@Injectable()
export class ReviewDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly conflicts: ApprovalConflictDiagnoser,
  ) {}

  async approve(
    org: OrgContext,
    proposalId: string,
    input: ApprovalInput,
  ): Promise<Result<ApprovalView, ApprovalError>> {
    const pending = await this.pending(org, proposalId);

    if (!pending.ok) return pending;
    if (pending.value.evidence === null) return err('missing-evidence');
    if (pending.value.steps.length === 0) return err('incomplete-proposal');

    const proposal = applyChoice(pending.value, input.applyTo);

    if (!proposal.ok) return proposal;

    const target = proposal.value.targetTestCaseId;
    const suiteId =
      target === null
        ? (proposal.value.suiteId ?? (await this.suiteFor(proposal.value)))
        : null;

    if (target === null && suiteId === null) return err('missing-suite');

    let approval: ApprovalView;

    try {
      approval = await this.publish(proposal.value, suiteId, input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return err(
          await this.conflicts.diagnose(org, proposal.value, suiteId, error),
        );
      }
      if (error instanceof DecisionConflict) return err('invalid-transition');
      throw error;
    }

    this.events.publish(DOMAIN_EVENTS.proposalApproved, {
      proposalId: proposal.value.id,
      projectId: proposal.value.projectId,
      organizationId: org.organizationId,
      suiteId: approval.suiteId,
      testCaseId: approval.testCaseId,
      versionId: approval.versionId,
      createdNewCase: approval.createdNewCase,
      actorId: input.actorId,
    });

    return ok(approval);
  }

  async reject(
    org: OrgContext,
    proposalId: string,
    input: DecisionInput,
  ): Promise<Result<RejectionView, ReviewError>> {
    const proposal = await this.pending(org, proposalId);

    if (!proposal.ok) return proposal;

    let decisionId: string;

    try {
      decisionId = await this.prisma.$transaction(async (tx) => {
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
    } catch (error) {
      if (error instanceof DecisionConflict) return err('invalid-transition');
      throw error;
    }

    this.events.publish(DOMAIN_EVENTS.proposalRejected, {
      proposalId: proposal.value.id,
      projectId: proposal.value.projectId,
      organizationId: org.organizationId,
      suiteId:
        proposal.value.suiteId ??
        proposal.value.targetTestCase?.suiteId ??
        null,
      decisionId,
      actorId: input.actorId,
    });

    return ok({ decisionId });
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
      orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
      select: {
        action: true,
        decidedAt: true,
        actor: { select: { id: true, name: true } },
      },
    });

    if (decision === null) return null;

    return {
      action: toDecidedAction(decision.action),
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
      // The case lock comes first, before the claim: a document-file job
      // holds the same lock while it deletes proposals of that case, so
      // claiming first could deadlock against it. Approval spends no credit,
      // so there is no organization row to lock ahead of it.
      if (proposal.targetTestCaseId !== null) {
        await lockTestCaseForUpdate(tx, proposal.targetTestCaseId);
      }

      const claim = await tx.extractedProposal.updateMany({
        where: { id: proposal.id, status: PENDING_STATUS },
        data: { status: 'approved' },
      });
      if (claim.count === 0) throw new DecisionConflict();

      const createdNewCase = proposal.targetTestCaseId === null;
      const automationFields = automationFieldsFor(proposal);
      const documentedState = documentedStateFor(proposal);
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
                ...documentedState,
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
        {
          priority: proposal.priority,
          state: 'active',
          ...automationFields,
          ...documentedState,
        },
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
          {
            projectId: proposal.projectId,
            fromType: 'proposal',
            fromId: proposal.id,
            toType: 'test_case_version',
            toId: version.id,
            relation: 'produced',
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

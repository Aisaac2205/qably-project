import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApprovalView,
  DecisionInput,
  ListProposalsFilters,
  ProposalDetailView,
  ProposalView,
  RejectionView,
  ReviewError,
} from './review.contracts';

const PENDING_STATUS = 'in_review';

const EVIDENCE_KIND: Record<string, 'source_excerpt' | 'artifact' | 'url'> = {
  SOURCE_EXCERPT: 'source_excerpt',
  ARTIFACT: 'artifact',
  URL: 'url',
};

const VIEW_SELECT = {
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
} as const;

interface ViewRow {
  id: string;
  projectId: string;
  status: ProposalView['status'];
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: ProposalView['priority'];
  evidenceId: string;
  targetTestCaseId: string | null;
}

interface EvidenceRow {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  uri: string;
  excerpt: string | null;
  createdAt: Date;
}

interface LinkRow {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
}

function toView(row: ViewRow): ProposalView {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    title: row.title,
    objective: row.objective,
    preconditions: row.preconditions,
    steps: row.steps,
    expectedResult: row.expectedResult,
    priority: row.priority,
    evidenceId: row.evidenceId,
    ...(row.targetTestCaseId === null
      ? {}
      : { targetOfficialTestCaseId: row.targetTestCaseId }),
  };
}

function toEvidence(row: EvidenceRow): ProposalDetailView['evidence'] {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: EVIDENCE_KIND[row.kind],
    title: row.title,
    uri: row.uri,
    ...(row.excerpt === null ? {} : { excerpt: row.excerpt }),
    createdAt: row.createdAt.toISOString(),
  };
}

function toLink(row: LinkRow): ProposalDetailView['links'][number] {
  return {
    id: row.id,
    from: {
      type: row.fromType as ProposalDetailView['links'][number]['from']['type'],
      id: row.fromId,
    },
    to: {
      type: row.toType as ProposalDetailView['links'][number]['to']['type'],
      id: row.toId,
    },
    relation: row.relation as ProposalDetailView['links'][number]['relation'],
  };
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

  async list(
    org: OrgContext,
    filters: ListProposalsFilters,
  ): Promise<ProposalView[]> {
    const rows = (await this.prisma.extractedProposal.findMany({
      where: {
        project: { organizationId: org.organizationId },
        ...(filters.projectId === undefined
          ? {}
          : { projectId: filters.projectId }),
        ...(filters.status === undefined ? {} : { status: filters.status }),
        ...(filters.duplicatesOnly === true
          ? { targetTestCaseId: { not: null } }
          : {}),
        ...(filters.search === undefined
          ? {}
          : {
              OR: [
                { title: { contains: filters.search, mode: 'insensitive' } },
                {
                  objective: { contains: filters.search, mode: 'insensitive' },
                },
              ],
            }),
      },
      orderBy: { createdAt: 'desc' },
      select: VIEW_SELECT,
    })) as ViewRow[];

    return rows.map(toView);
  }

  async findOne(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<ProposalDetailView, ReviewError>> {
    const row = (await this.prisma.extractedProposal.findFirst({
      where: {
        id: proposalId,
        project: { organizationId: org.organizationId },
      },
      select: { ...VIEW_SELECT, evidence: true },
    })) as (ViewRow & { evidence: EvidenceRow | null }) | null;

    if (row === null) return err('not-found');

    const links = (await this.prisma.traceabilityLink.findMany({
      where: {
        projectId: row.projectId,
        OR: [
          { fromType: 'proposal', fromId: row.id },
          { toType: 'proposal', toId: row.id },
        ],
      },
    })) as LinkRow[];

    return ok({
      ...toView(row),
      evidence: row.evidence === null ? null : toEvidence(row.evidence),
      links: links.map(toLink),
    });
  }

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

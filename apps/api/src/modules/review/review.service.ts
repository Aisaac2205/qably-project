import { Injectable } from '@nestjs/common';
import { err, isErr, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApprovalView,
  BulkDecisionItemResult,
  DecisionInput,
  ListProposalsFilters,
  ProposalDetailView,
  ProposalView,
  RejectionView,
  ReviewError,
  SuiteProposalDecisionView,
  SuiteProposalView,
} from './review.contracts';

const PENDING_STATUS = 'in_review';
const UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

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
  needsManualReview: true,
  targetTestCaseId: true,
  locale: true,
  observations: true,
  evidence: { select: { title: true } },
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
  needsManualReview: boolean;
  targetTestCaseId: string | null;
  locale?: string | null;
  observations?: unknown;
  evidence: { title: string } | null;
}

function observationsOf(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const strings = raw.filter((item): item is string => typeof item === 'string');
  return strings.length === 0 ? undefined : strings;
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
    needsManualReview: row.needsManualReview,
    evidenceTitle: row.evidence === null ? '' : row.evidence.title,
    locale: row.locale ?? null,
    ...(observationsOf(row.observations) === undefined
      ? {}
      : { observations: observationsOf(row.observations) }),
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

const HUMAN_NAME_SOURCE = 'human';
const AERIS_NAME_SOURCE = 'aeris';

const SUITE_PROPOSAL_SELECT = {
  id: true,
  projectId: true,
  suiteId: true,
  title: true,
  description: true,
  status: true,
  evidenceId: true,
  createdAt: true,
  decidedAt: true,
  suite: { select: { name: true, nameSource: true } },
} as const;

interface SuiteProposalRow {
  id: string;
  projectId: string;
  suiteId: string;
  title: string;
  description: string;
  status: ProposalView['status'];
  evidenceId: string;
  createdAt: Date;
  decidedAt: Date | null;
  suite: { name: string; nameSource: string };
}

function toSuiteProposalView(row: SuiteProposalRow): SuiteProposalView {
  return {
    id: row.id,
    projectId: row.projectId,
    suiteId: row.suiteId,
    suiteName: row.suite.name,
    suiteNameSource: row.suite.nameSource as SuiteProposalView['suiteNameSource'],
    title: row.title,
    description: row.description,
    status: row.status,
    evidenceId: row.evidenceId,
    locale: null,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
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
    if (proposal.value.steps.length === 0) return err('incomplete-proposal');

    const target = proposal.value.targetTestCaseId;
    const suiteId =
      target === null
        ? (proposal.value.suiteId ?? (await this.suiteFor(proposal.value)))
        : null;

    if (target === null && suiteId === null) return err('missing-suite');

    try {
      return ok(await this.publish(proposal.value, suiteId, input));
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
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

  async approveMany(
    org: OrgContext,
    ids: string[],
    input: DecisionInput,
  ): Promise<BulkDecisionItemResult[]> {
    const results: BulkDecisionItemResult[] = [];

    for (const id of Array.from(new Set(ids))) {
      const result = await this.approve(org, id, input);
      results.push(
        isErr(result)
          ? { id, outcome: 'skipped', reason: result.error }
          : { id, outcome: 'approved' },
      );
    }

    return results;
  }

  async rejectMany(
    org: OrgContext,
    ids: string[],
    input: DecisionInput,
  ): Promise<BulkDecisionItemResult[]> {
    const results: BulkDecisionItemResult[] = [];

    for (const id of Array.from(new Set(ids))) {
      const result = await this.reject(org, id, input);
      results.push(
        isErr(result)
          ? { id, outcome: 'skipped', reason: result.error }
          : { id, outcome: 'rejected' },
      );
    }

    return results;
  }

  async listSuiteProposals(
    org: OrgContext,
    filters: ListProposalsFilters,
  ): Promise<SuiteProposalView[]> {
    const rows = (await this.prisma.suiteProposal.findMany({
      where: {
        project: { organizationId: org.organizationId },
        ...(filters.projectId === undefined
          ? {}
          : { projectId: filters.projectId }),
        ...(filters.status === undefined ? {} : { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
      select: SUITE_PROPOSAL_SELECT,
    })) as SuiteProposalRow[];

    return rows.map(toSuiteProposalView);
  }

  async approveSuiteProposal(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<SuiteProposalDecisionView, ReviewError>> {
    const pending = await this.pendingSuiteProposal(org, proposalId);
    if (!pending.ok) return pending;
    const proposal = pending.value;
    const applies = proposal.suite.nameSource !== HUMAN_NAME_SOURCE;

    try {
      const suiteName = await this.prisma.$transaction(async (tx) => {
        const suite = applies
          ? await tx.suite.update({
              where: { id: proposal.suiteId },
              data: {
                name: proposal.title,
                description: proposal.description,
                nameSource: AERIS_NAME_SOURCE,
              },
              select: { name: true },
            })
          : { name: proposal.suite.name };

        await tx.suiteProposal.update({
          where: { id: proposal.id },
          data: { status: 'approved', decidedAt: new Date() },
        });

        return suite.name;
      });

      return ok({
        proposalId: proposal.id,
        applied: applies,
        suiteId: proposal.suiteId,
        suiteName,
      });
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      throw error;
    }
  }

  async rejectSuiteProposal(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<SuiteProposalDecisionView, ReviewError>> {
    const pending = await this.pendingSuiteProposal(org, proposalId);
    if (!pending.ok) return pending;
    const proposal = pending.value;

    await this.prisma.suiteProposal.update({
      where: { id: proposal.id },
      data: { status: 'rejected', decidedAt: new Date() },
    });

    return ok({
      proposalId: proposal.id,
      applied: false,
      suiteId: proposal.suiteId,
      suiteName: proposal.suite.name,
    });
  }

  private async pendingSuiteProposal(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<SuiteProposalRow, ReviewError>> {
    const row = (await this.prisma.suiteProposal.findFirst({
      where: {
        id: proposalId,
        project: { organizationId: org.organizationId },
      },
      select: SUITE_PROPOSAL_SELECT,
    })) as SuiteProposalRow | null;

    if (row === null) return err('not-found');
    if (row.status !== PENDING_STATUS) return err('invalid-transition');

    return ok(row);
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
          locale: proposal.locale ?? null,
        },
        select: { id: true, version: true },
      });

      await tx.testCase.update({
        where: { id: testCaseId },
        data: {
          currentVersionId: version.id,
          name: proposal.title,
          steps: proposal.steps,
          expectedResult: proposal.expectedResult,
          priority: proposal.priority,
          state: 'active',
          ...automationFields,
        },
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
        testCaseName: proposal.title,
        suiteId: createdNewCase ? (suiteId as string) : (proposal.suiteId ?? null),
        versionId: version.id,
        version: version.version,
        decisionId: decision.id,
      };
    });
  }
}

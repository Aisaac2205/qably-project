import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DuplicateCandidateView,
  ListProposalsFilters,
  ProposalDetailView,
  ProposalView,
  ReviewError,
} from './review.contracts';
import {
  rankDuplicateCandidates,
  type DuplicateRankCandidate,
} from './lib/rank-duplicate-candidates';
import {
  toEvidence,
  toLink,
  toView,
  VIEW_SELECT,
  type EvidenceRow,
  type LinkRow,
  type ViewRow,
} from './lib/proposal-view';

const DUPLICATE_TARGET_SELECT = {
  id: true,
  projectId: true,
  title: true,
  automationKey: true,
  targetTestCaseId: true,
} as const;

interface DuplicateTargetRow {
  id: string;
  projectId: string;
  title: string;
  automationKey: string | null;
  targetTestCaseId: string | null;
}

const DUPLICATE_FLAG_SELECT = {
  id: true,
  projectId: true,
  name: true,
  automationKey: true,
  updatedAt: true,
} as const;

interface DuplicateFlagRow {
  id: string;
  projectId: string;
  name: string;
  automationKey: string | null;
  updatedAt: Date;
}

const DUPLICATE_CANDIDATE_SELECT = {
  id: true,
  name: true,
  automationKey: true,
  steps: true,
  expectedResult: true,
  updatedAt: true,
} as const;

interface DuplicateCandidateRow {
  id: string;
  name: string;
  automationKey: string | null;
  steps: string[];
  expectedResult: string;
  updatedAt: Date;
}

function toDuplicateRankCandidate(
  row: DuplicateCandidateRow,
): DuplicateRankCandidate {
  return {
    id: row.id,
    title: row.name,
    steps: row.steps,
    expectedResult: row.expectedResult,
    automationKey: row.automationKey,
    publishedAt: row.updatedAt,
  };
}

@Injectable()
export class ReviewInboxQueryService {
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

    const flagged = await this.flagPossibleDuplicates(rows);
    const views = rows.map((row) => toView(row, flagged.has(row.id)));

    return filters.duplicatesOnly === true
      ? views.filter((view) => view.possibleDuplicate === true)
      : views;
  }

  private async flagPossibleDuplicates(
    rows: readonly ViewRow[],
  ): Promise<Set<string>> {
    const untargeted = rows.filter((row) => row.targetTestCaseId === null);
    if (untargeted.length === 0) return new Set();

    const projectIds = [...new Set(untargeted.map((row) => row.projectId))];
    const cases = (await this.prisma.testCase.findMany({
      where: { projectId: { in: projectIds } },
      select: DUPLICATE_FLAG_SELECT,
    })) as DuplicateFlagRow[];

    const candidatesByProject = new Map<string, DuplicateRankCandidate[]>();
    for (const row of cases) {
      const list = candidatesByProject.get(row.projectId) ?? [];
      list.push({
        id: row.id,
        title: row.name,
        steps: [],
        expectedResult: '',
        automationKey: row.automationKey,
        publishedAt: row.updatedAt,
      });
      candidatesByProject.set(row.projectId, list);
    }

    const flagged = new Set<string>();
    for (const row of untargeted) {
      const ranked = rankDuplicateCandidates(
        { title: row.title, automationKey: row.automationKey },
        candidatesByProject.get(row.projectId) ?? [],
      );
      if (ranked.length > 0) flagged.add(row.id);
    }

    return flagged;
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

  async getDuplicateCandidates(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<DuplicateCandidateView[], ReviewError>> {
    const proposal: DuplicateTargetRow | null =
      await this.prisma.extractedProposal.findFirst({
        where: {
          id: proposalId,
          project: { organizationId: org.organizationId },
        },
        select: DUPLICATE_TARGET_SELECT,
      });

    if (proposal === null) return err('not-found');

    const cases = (await this.prisma.testCase.findMany({
      where: {
        projectId: proposal.projectId,
        ...(proposal.targetTestCaseId === null
          ? {}
          : { id: { not: proposal.targetTestCaseId } }),
      },
      orderBy: { id: 'asc' },
      select: DUPLICATE_CANDIDATE_SELECT,
    })) as DuplicateCandidateRow[];

    const ranked = rankDuplicateCandidates(
      { title: proposal.title, automationKey: proposal.automationKey },
      cases.map(toDuplicateRankCandidate),
    );

    return ok(
      ranked.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        steps: [...candidate.steps],
        expectedResult: candidate.expectedResult,
        matchReason: candidate.matchReason,
      })),
    );
  }
}

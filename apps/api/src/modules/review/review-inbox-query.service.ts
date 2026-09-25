import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ProposalStatus } from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DuplicateCandidateView,
  InboxItem,
  ListProposalsFilters,
  ProposalDetailView,
  ProposalView,
  ReviewError,
  ReviewInboxCounts,
  ReviewInboxCountsFilters,
  ReviewInboxDuplicateKindCounts,
  ReviewInboxPage,
  ReviewInboxPageFilters,
  ReviewInboxStatusCounts,
} from './review.contracts';
import type {
  ProposalClassification,
  ProposalDuplicateKind,
} from './lib/classify-proposal';
import {
  rankDuplicateCandidates,
  type DuplicateRankCandidate,
} from './lib/rank-duplicate-candidates';
import { decodeInboxCursor, encodeInboxCursor } from './lib/inbox-cursor';
import {
  toEvidence,
  toLink,
  toView,
  VIEW_SELECT,
  type EvidenceRow,
  type LinkRow,
  type ViewRow,
} from './lib/proposal-view';

const INBOX_STATUSES: ProposalStatus[] = [
  'in_review',
  'approved',
  'rejected',
  'changes_requested',
];

function emptyStatusCounts(): ReviewInboxStatusCounts {
  return {
    in_review: 0,
    approved: 0,
    rejected: 0,
    changes_requested: 0,
  };
}

function emptyDuplicateKindCounts(): ReviewInboxDuplicateKindCounts {
  return { none: 0, update: 0, possible_duplicate: 0 };
}

interface GroupedStatusRow {
  status: ProposalStatus;
  _count: { _all: number };
  _max: { updatedAt: Date | null };
}

interface GroupedDuplicateKindRow {
  duplicateKind: ProposalDuplicateKind | null;
  _count: { _all: number };
  _max: { updatedAt: Date | null };
}

function hashGroupedRows<
  T extends { _count: { _all: number }; _max: { updatedAt: Date | null } },
>(rows: readonly T[], keyOf: (row: T) => string): string {
  const payload = rows
    .map((row) => ({ key: keyOf(row), row }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(
      (entry) =>
        `${entry.key}:${entry.row._count._all}:${entry.row._max.updatedAt?.toISOString() ?? ''}`,
    )
    .join('|');
  return createHash('sha1').update(payload).digest('hex');
}

function hashCounts(rows: readonly GroupedStatusRow[]): string {
  return hashGroupedRows(rows, (row) => row.status);
}

function hashDuplicateKindCounts(
  rows: readonly GroupedDuplicateKindRow[],
): string {
  return hashGroupedRows(rows, (row) => row.duplicateKind ?? 'none');
}

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

const INBOX_ITEM_SELECT = {
  ...VIEW_SELECT,
  suite: { select: { id: true, name: true } },
  duplicateKind: true,
  matchedCaseId: true,
  duplicateScore: true,
  duplicateReasons: true,
} as const;

interface InboxItemRow extends ViewRow {
  suite: { id: string; name: string } | null;
  duplicateKind: ProposalDuplicateKind | null;
  matchedCaseId: string | null;
  duplicateScore: number | null;
  duplicateReasons: unknown;
}

function toClassification(row: InboxItemRow): ProposalClassification {
  if (row.duplicateKind === null) {
    return { kind: 'none', matchedCaseId: null, score: null, reasons: [] };
  }

  return {
    kind: row.duplicateKind,
    matchedCaseId: row.matchedCaseId,
    score: row.duplicateScore,
    reasons: Array.isArray(row.duplicateReasons)
      ? (row.duplicateReasons as ProposalClassification['reasons'])
      : [],
  };
}

function toInboxItem(row: InboxItemRow): InboxItem {
  return {
    ...toView(row),
    suite: row.suite,
    classification: toClassification(row),
  };
}

@Injectable()
export class ReviewInboxQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(
    org: OrgContext,
    filters: { projectId?: string; status?: ProposalStatus; search?: string },
  ): Prisma.ExtractedProposalWhereInput {
    return {
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
    };
  }

  async list(
    org: OrgContext,
    filters: ListProposalsFilters,
  ): Promise<ProposalView[]> {
    const rows = (await this.prisma.extractedProposal.findMany({
      where: this.baseWhere(org, filters),
      orderBy: { createdAt: 'desc' },
      select: VIEW_SELECT,
    })) as ViewRow[];

    const flagged = await this.flagPossibleDuplicates(rows);
    const views = rows.map((row) => toView(row, flagged.has(row.id)));

    return filters.duplicatesOnly === true
      ? views.filter((view) => view.possibleDuplicate === true)
      : views;
  }

  async page(
    org: OrgContext,
    filters: ReviewInboxPageFilters,
  ): Promise<ReviewInboxPage> {
    const status = filters.status === 'all' ? undefined : filters.status;

    const base: Prisma.ExtractedProposalWhereInput = {
      ...this.baseWhere(org, { ...filters, status }),
      ...(filters.duplicatesOnly === true
        ? { duplicateKind: 'possible_duplicate' }
        : {}),
    };

    const cursor =
      filters.cursor === undefined ? null : decodeInboxCursor(filters.cursor);
    const where =
      cursor === null
        ? base
        : {
            AND: [
              base,
              {
                OR: [
                  { createdAt: { lt: new Date(cursor.createdAt) } },
                  {
                    createdAt: new Date(cursor.createdAt),
                    id: { lt: cursor.id },
                  },
                ],
              },
            ],
          };

    const rows = (await this.prisma.extractedProposal.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: INBOX_ITEM_SELECT,
      take: filters.limit + 1,
    })) as InboxItemRow[];

    const hasMore = rows.length > filters.limit;
    const pageRows = hasMore ? rows.slice(0, filters.limit) : rows;
    const items = pageRows.map(toInboxItem);

    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last?.createdAt !== undefined
        ? encodeInboxCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return { items, nextCursor };
  }

  async counts(
    org: OrgContext,
    filters: ReviewInboxCountsFilters,
  ): Promise<ReviewInboxCounts> {
    const where = this.baseWhere(org, filters);

    const [groupedByStatus, groupedByDuplicateKind] = await Promise.all([
      this.prisma.extractedProposal.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      }) as unknown as Promise<GroupedStatusRow[]>,
      this.prisma.extractedProposal.groupBy({
        by: ['duplicateKind'],
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      }) as unknown as Promise<GroupedDuplicateKindRow[]>,
    ]);

    const byStatus = emptyStatusCounts();
    for (const row of groupedByStatus) {
      if (INBOX_STATUSES.includes(row.status)) {
        byStatus[row.status] = row._count._all;
      }
    }

    const byDuplicateKind = emptyDuplicateKindCounts();
    for (const row of groupedByDuplicateKind) {
      const kind = row.duplicateKind ?? 'none';
      byDuplicateKind[kind] += row._count._all;
    }

    const version = createHash('sha1')
      .update(
        `${hashCounts(groupedByStatus)}|${hashDuplicateKindCounts(groupedByDuplicateKind)}`,
      )
      .digest('hex');

    return { byStatus, byDuplicateKind, version };
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

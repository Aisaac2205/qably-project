import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CaseStatus, ProposalStatus } from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewDecisionService } from './review-decision.service';
import type {
  InboxClassification,
  InboxItem,
  MatchedCaseView,
  ProposalDetailView,
  ProposalSourceView,
  PublishedVersionView,
  RecentRunView,
  ReviewError,
  ReviewInboxCounts,
  ReviewInboxCountsFilters,
  ReviewInboxDuplicateKindCounts,
  ReviewInboxPage,
  ReviewInboxPageFilters,
  ReviewInboxStatusCounts,
} from './review.contracts';
import type { ProposalDuplicateKind } from './lib/classify-proposal';
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

const RECENT_RUNS_LIMIT = 5;

interface CaseRefRow {
  id: string;
  name: string;
  suiteId: string;
  suite: { name: string };
  currentVersion: VersionRow | null;
}

interface VersionRow {
  version: number;
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  publishedAt: Date;
}

const CASE_REF_SELECT = {
  id: true,
  name: true,
  suiteId: true,
  suite: { select: { name: true } },
  currentVersion: {
    select: {
      version: true,
      title: true,
      objective: true,
      preconditions: true,
      steps: true,
      expectedResult: true,
      publishedAt: true,
    },
  },
} as const;

interface DetailRow extends Omit<ViewRow, 'targetTestCase'> {
  evidence: EvidenceRow | null;
  targetTestCase: CaseRefRow | null;
  codeChange: {
    filePath: string;
    commitSha: string;
    pullRequestNumber: number | null;
  } | null;
  duplicateKind: ProposalDuplicateKind | null;
  matchedCaseId: string | null;
  matchedCase: CaseRefRow | null;
}

function resolveCaseRef(row: DetailRow): CaseRefRow | null {
  return row.targetTestCase ?? row.matchedCase;
}

function toMatchedCase(ref: CaseRefRow | null): MatchedCaseView | null {
  if (ref === null) return null;
  return {
    id: ref.id,
    name: ref.name,
    suiteId: ref.suiteId,
    suiteName: ref.suite.name,
  };
}

function toSource(row: DetailRow): ProposalSourceView | null {
  if (row.codeChange === null) return null;
  return {
    filePath: row.codeChange.filePath,
    uri: row.evidence === null ? '' : row.evidence.uri,
    commitSha:
      row.codeChange.commitSha === '' ? null : row.codeChange.commitSha,
    pullRequestNumber: row.codeChange.pullRequestNumber,
  };
}

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

const INBOX_ITEM_SELECT = {
  ...VIEW_SELECT,
  suite: { select: { id: true, name: true } },
  duplicateKind: true,
  matchedCaseId: true,
  matchedCase: { select: { name: true } },
  duplicateScore: true,
  duplicateReasons: true,
} as const;

interface InboxItemRow extends ViewRow {
  suite: { id: string; name: string } | null;
  duplicateKind: ProposalDuplicateKind | null;
  matchedCaseId: string | null;
  matchedCase: { name: string } | null;
  duplicateScore: number | null;
  duplicateReasons: unknown;
}

function toClassification(row: InboxItemRow): InboxClassification {
  if (row.duplicateKind === null) {
    return {
      kind: 'none',
      matchedCaseId: null,
      matchedCaseName: null,
      score: null,
      reasons: [],
    };
  }

  return {
    kind: row.duplicateKind,
    matchedCaseId: row.matchedCaseId,
    matchedCaseName: row.matchedCase === null ? null : row.matchedCase.name,
    score: row.duplicateScore,
    reasons: Array.isArray(row.duplicateReasons)
      ? (row.duplicateReasons as InboxClassification['reasons'])
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly decisions: ReviewDecisionService,
  ) {}

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

  async findOne(
    org: OrgContext,
    proposalId: string,
  ): Promise<Result<ProposalDetailView, ReviewError>> {
    const row = (await this.prisma.extractedProposal.findFirst({
      where: {
        id: proposalId,
        project: { organizationId: org.organizationId },
      },
      select: {
        ...VIEW_SELECT,
        evidence: true,
        codeChange: {
          select: {
            filePath: true,
            commitSha: true,
            pullRequestNumber: true,
          },
        },
        duplicateKind: true,
        matchedCaseId: true,
        matchedCase: { select: CASE_REF_SELECT },
        targetTestCase: { select: CASE_REF_SELECT },
      },
    })) as DetailRow | null;

    if (row === null) return err('not-found');

    const [links, decision] = await Promise.all([
      this.prisma.traceabilityLink.findMany({
        where: {
          projectId: row.projectId,
          OR: [
            { fromType: 'proposal', fromId: row.id },
            { toType: 'proposal', toId: row.id },
          ],
        },
      }) as Promise<LinkRow[]>,
      this.decisions.lastDecision(org, proposalId),
    ]);

    const caseRef = resolveCaseRef(row);

    const [publishedVersion, recentRuns] = await Promise.all([
      this.publishedVersionFor(org, caseRef),
      this.recentRunsFor(caseRef),
    ]);

    return ok({
      ...toView(row),
      evidence: row.evidence === null ? null : toEvidence(row.evidence),
      links: links.map(toLink),
      matchedCase: toMatchedCase(caseRef),
      publishedVersion,
      source: toSource(row),
      recentRuns,
      decision,
    });
  }

  private async publishedVersionFor(
    org: OrgContext,
    caseRef: CaseRefRow | null,
  ): Promise<PublishedVersionView | null> {
    const version = caseRef?.currentVersion ?? null;
    if (version === null) return null;

    const approval = await this.prisma.reviewDecision.findFirst({
      where: {
        action: 'approved',
        decidedAt: version.publishedAt,
        proposal: { project: { organizationId: org.organizationId } },
      },
      select: { actor: { select: { id: true, name: true } } },
    });

    return {
      version: version.version,
      title: version.title,
      objective: version.objective,
      preconditions: version.preconditions,
      steps: version.steps,
      expectedResult: version.expectedResult,
      publishedAt: version.publishedAt.toISOString(),
      publishedBy:
        approval === null
          ? null
          : { id: approval.actor.id, name: approval.actor.name },
    };
  }

  private async recentRunsFor(
    caseRef: CaseRefRow | null,
  ): Promise<RecentRunView[]> {
    if (caseRef === null) return [];

    const rows = (await this.prisma.runCase.findMany({
      where: { testCaseId: caseRef.id, recordedAt: { not: null } },
      orderBy: { recordedAt: 'desc' },
      take: RECENT_RUNS_LIMIT,
      select: { runId: true, status: true, recordedAt: true },
    })) as { runId: string; status: CaseStatus; recordedAt: Date | null }[];

    return rows
      .filter((row) => row.recordedAt !== null)
      .map((row) => ({
        runId: row.runId,
        status: row.status,
        recordedAt: (row.recordedAt as Date).toISOString(),
      }));
  }
}

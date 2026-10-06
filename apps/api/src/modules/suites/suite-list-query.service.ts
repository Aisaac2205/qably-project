import { Injectable } from '@nestjs/common';
import { collectSuiteTags, suiteSortKey } from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import { readRecentRunStatuses } from './lib/recent-run-statuses';
import {
  SUITE_SUMMARY_SELECT,
  toSummaryBase,
} from './lib/suite-summaries-candidates';
import { matchesFilters } from './lib/suite-summaries-filters';
import { cutPage } from './lib/suite-summaries-page';
import {
  planStatusResolution,
  resolveSuiteSummaries,
  withRunStatus,
} from './lib/suite-summaries-status';
import type { SuiteSummariesPage, SuiteTagsFacet } from './suites.contracts';
import type {
  ListSuiteSummariesQuery,
  ListSuiteTagsQuery,
} from './suites.schemas';

@Injectable()
export class SuiteListQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async page(
    org: OrgContext,
    query: ListSuiteSummariesQuery,
  ): Promise<SuiteSummariesPage> {
    const { limit, cursor } = query;
    const rows = await this.prisma.suite.findMany({
      where: {
        organizationId: org.organizationId,
        projectId: query.projectId,
      },
      select: SUITE_SUMMARY_SELECT,
    });
    const candidates = rows
      .map(toSummaryBase)
      .filter((candidate) => matchesFilters(candidate, query));
    const plan = planStatusResolution(query);

    if (plan.order === 'status-first') {
      const windows = await this.windows(org, candidates);
      const { page, nextCursor } = cutPage(
        resolveSuiteSummaries(candidates, windows, plan.status),
        (summary) => suiteSortKey(summary, plan.sort),
        { limit, cursor },
      );

      return { items: page, nextCursor };
    }

    const { page, nextCursor } = cutPage(
      candidates,
      (candidate) => suiteSortKey(candidate, plan.sort),
      { limit, cursor },
    );
    const windows = await this.windows(org, page);

    return {
      items: page.map((candidate) => withRunStatus(candidate, windows)),
      nextCursor,
    };
  }

  async tags(
    org: OrgContext,
    query: ListSuiteTagsQuery,
  ): Promise<SuiteTagsFacet> {
    const rows = await this.prisma.suite.findMany({
      where: {
        organizationId: org.organizationId,
        projectId: query.projectId,
      },
      select: { tags: true },
    });

    return { items: collectSuiteTags(rows.map((row) => row.tags)) };
  }

  private windows(org: OrgContext, suites: readonly { id: string }[]) {
    return readRecentRunStatuses(
      this.prisma,
      org.organizationId,
      suites.map((suite) => suite.id),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { collectSuiteTags } from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { SuiteTagsFacet } from './suites.contracts';
import type { ListSuiteTagsQuery } from './suites.schemas';

@Injectable()
export class SuiteListQueryService {
  constructor(private readonly prisma: PrismaService) {}

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
}

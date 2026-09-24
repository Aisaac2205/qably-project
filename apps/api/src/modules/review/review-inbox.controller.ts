import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { ReviewInboxCounts, ReviewInboxPage } from './review.contracts';
import {
  reviewInboxCountsQuerySchema,
  reviewInboxQuerySchema,
  type ReviewInboxCountsQuery,
  type ReviewInboxQuery,
} from './review.schemas';
import { ReviewInboxQueryService } from './review-inbox-query.service';

@Controller('review/inbox')
@UseGuards(OrgScopeGuard)
export class ReviewInboxController {
  constructor(private readonly queries: ReviewInboxQueryService) {}

  @Get()
  page(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(reviewInboxQuerySchema))
    query: ReviewInboxQuery,
  ): Promise<ReviewInboxPage> {
    return this.queries.page(org, query);
  }

  @Get('counts')
  counts(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(reviewInboxCountsQuerySchema))
    query: ReviewInboxCountsQuery,
  ): Promise<ReviewInboxCounts> {
    return this.queries.counts(org, query);
  }
}

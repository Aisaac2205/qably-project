import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ApprovalView,
  DuplicateCandidateView,
  ProposalDetailView,
  ProposalView,
  RejectionView,
} from './review.contracts';
import {
  decisionSchema,
  listProposalsQuerySchema,
  type DecisionBody,
  type ListProposalsQuery,
} from './review.schemas';
import { unwrap, unwrapDecision } from './lib/review-error-http';
import { ReviewInboxQueryService } from './review-inbox-query.service';
import { ReviewDecisionService } from './review-decision.service';

@Controller('review/proposals')
@UseGuards(OrgScopeGuard)
export class ReviewController {
  constructor(
    private readonly queries: ReviewInboxQueryService,
    private readonly review: ReviewDecisionService,
  ) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listProposalsQuerySchema))
    query: ListProposalsQuery,
  ): Promise<ProposalView[]> {
    return this.queries.list(org, query);
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<ProposalDetailView> {
    return unwrap(await this.queries.findOne(org, id));
  }

  @Get(':id/duplicates')
  async duplicates(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<DuplicateCandidateView[]> {
    return unwrap(await this.queries.getDuplicateCandidates(org, id));
  }

  @Post(':id/approve')
  async approve(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
  ): Promise<ApprovalView> {
    return unwrapDecision(
      await this.review.approve(org, id, { actorId: user.id, ...body }),
      () => this.review.lastDecision(org, id),
    );
  }

  @Post(':id/reject')
  async reject(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
  ): Promise<RejectionView> {
    return unwrapDecision(
      await this.review.reject(org, id, { actorId: user.id, ...body }),
      () => this.review.lastDecision(org, id),
    );
  }
}

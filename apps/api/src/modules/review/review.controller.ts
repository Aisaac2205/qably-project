import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ApprovalView,
  ProposalDetailView,
  RejectionView,
} from './review.contracts';
import { decisionSchema, type DecisionBody } from './review.schemas';
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

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<ProposalDetailView> {
    return unwrap(await this.queries.findOne(org, id));
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

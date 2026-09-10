import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import { unwrap } from './review.controller';
import type {
  SuiteProposalDecisionView,
  SuiteProposalView,
} from './review.contracts';
import {
  listProposalsQuerySchema,
  type ListProposalsQuery,
} from './review.schemas';
import { ReviewService } from './review.service';

@Controller('review/suite-proposals')
@UseGuards(OrgScopeGuard)
export class SuiteProposalsController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listProposalsQuerySchema))
    query: ListProposalsQuery,
  ): Promise<SuiteProposalView[]> {
    return this.review.listSuiteProposals(org, query);
  }

  @Post(':id/approve')
  async approve(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<SuiteProposalDecisionView> {
    return unwrap(await this.review.approveSuiteProposal(org, id));
  }

  @Post(':id/reject')
  async reject(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<SuiteProposalDecisionView> {
    return unwrap(await this.review.rejectSuiteProposal(org, id));
  }
}

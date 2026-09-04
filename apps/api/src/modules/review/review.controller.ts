import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ApprovalView,
  ProposalDetailView,
  ProposalView,
  RejectionView,
  ReviewError,
} from './review.contracts';
import {
  decisionSchema,
  listProposalsQuerySchema,
  type DecisionBody,
  type ListProposalsQuery,
} from './review.schemas';
import { ReviewService } from './review.service';

function unwrap<T>(result: Result<T, ReviewError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException('Proposal not found');
    case 'invalid-transition':
      throw new ConflictException('This proposal was already decided');
    case 'missing-evidence':
      throw new UnprocessableEntityException(
        'The evidence backing this proposal is no longer available',
      );
    case 'missing-suite':
      throw new UnprocessableEntityException(
        'This project has no suite to publish the official case into',
      );
    case 'name-taken':
      throw new ConflictException(
        'Another official case in this suite already uses that title',
      );
  }
}

@Controller('review/proposals')
@UseGuards(OrgScopeGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(new ZodValidationPipe(listProposalsQuerySchema))
    query: ListProposalsQuery,
  ): Promise<ProposalView[]> {
    return this.review.list(org, query);
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
  ): Promise<ProposalDetailView> {
    return unwrap(await this.review.findOne(org, id));
  }

  @Post(':id/approve')
  async approve(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
  ): Promise<ApprovalView> {
    return unwrap(
      await this.review.approve(org, id, { actorId: user.id, ...body }),
    );
  }

  @Post(':id/reject')
  async reject(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody,
  ): Promise<RejectionView> {
    return unwrap(
      await this.review.reject(org, id, { actorId: user.id, ...body }),
    );
  }
}

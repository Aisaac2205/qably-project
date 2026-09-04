import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toProposalDrafts, type SeedCandidate } from './lib/proposal-draft';

@Injectable()
export class ExtractionService {
  constructor(private readonly prisma: PrismaService) {}

  async seed(candidates: SeedCandidate[]): Promise<number> {
    const drafts = toProposalDrafts(candidates);

    if (drafts.length === 0) return 0;

    const { count } = await this.prisma.extractedProposal.createMany({
      data: drafts,
      skipDuplicates: true,
    });

    return count;
  }
}

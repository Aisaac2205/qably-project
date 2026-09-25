import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  classifyProposal,
  type ClassifyProposalCandidate,
} from '../review/lib/classify-proposal';
import {
  PROPOSAL_CLASSIFICATION_QUEUE,
  type ReclassifySuiteJobData,
} from './proposal-classification.contracts';

interface ProposalToClassify {
  id: string;
  automationKey: string | null;
  title: string;
  steps: string[];
  expectedResult: string;
  targetTestCaseId: string | null;
}

interface CaseCandidateRow {
  id: string;
  suiteId: string;
  automationKey: string | null;
  name: string;
  steps: string[];
  expectedResult: string;
}

const PROPOSAL_SELECT = {
  id: true,
  automationKey: true,
  title: true,
  steps: true,
  expectedResult: true,
  targetTestCaseId: true,
} as const;

const CASE_CANDIDATE_SELECT = {
  id: true,
  suiteId: true,
  automationKey: true,
  name: true,
  steps: true,
  expectedResult: true,
} as const;

function toCandidate(row: CaseCandidateRow): ClassifyProposalCandidate {
  return {
    id: row.id,
    suiteId: row.suiteId,
    automationKey: row.automationKey,
    title: row.name,
    steps: row.steps,
    expectedResult: row.expectedResult,
  };
}

@Processor(PROPOSAL_CLASSIFICATION_QUEUE)
export class ReclassifySuiteProcessor extends WorkerHost {
  private readonly logger = new Logger(ReclassifySuiteProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReclassifySuiteJobData>): Promise<void> {
    const { suiteId } = job.data;

    const proposals = (await this.prisma.extractedProposal.findMany({
      where: { suiteId, status: 'in_review' },
      select: PROPOSAL_SELECT,
    })) as ProposalToClassify[];

    if (proposals.length === 0) return;

    const suite = await this.prisma.suite.findUnique({
      where: { id: suiteId },
      select: { projectId: true },
    });

    if (suite === null) return;

    const candidates = await this.loadCandidates(
      suiteId,
      suite.projectId,
      proposals,
    );

    for (const proposal of proposals) {
      await this.classifyAndPersist(suiteId, proposal, candidates);
    }

    this.logger.log(
      `Reclassified ${proposals.length} in_review proposal(s) for suite ${suiteId}`,
    );
  }

  private async loadCandidates(
    suiteId: string,
    projectId: string,
    proposals: readonly ProposalToClassify[],
  ): Promise<ClassifyProposalCandidate[]> {
    const suiteCases = (await this.prisma.testCase.findMany({
      where: { suiteId },
      select: CASE_CANDIDATE_SELECT,
    })) as CaseCandidateRow[];

    const proposalKeys = [
      ...new Set(
        proposals
          .map((proposal) => proposal.automationKey)
          .filter((key): key is string => key !== null),
      ),
    ];

    const crossSuiteCases =
      proposalKeys.length === 0
        ? []
        : ((await this.prisma.testCase.findMany({
            where: {
              projectId,
              suiteId: { not: suiteId },
              automationKey: { in: proposalKeys },
            },
            select: CASE_CANDIDATE_SELECT,
          })) as CaseCandidateRow[]);

    return [...suiteCases, ...crossSuiteCases].map(toCandidate);
  }

  private async classifyAndPersist(
    suiteId: string,
    proposal: ProposalToClassify,
    candidates: readonly ClassifyProposalCandidate[],
  ): Promise<void> {
    const classification = classifyProposal(
      {
        automationKey: proposal.automationKey,
        suiteId,
        title: proposal.title,
        steps: proposal.steps,
        expectedResult: proposal.expectedResult,
      },
      candidates,
      suiteId,
    );

    const setsTargetCase =
      classification.kind === 'update' &&
      proposal.targetTestCaseId === null &&
      classification.matchedCaseId !== null;

    await this.prisma.extractedProposal.update({
      where: { id: proposal.id },
      data: {
        duplicateKind: classification.kind,
        matchedCaseId: classification.matchedCaseId,
        duplicateScore: classification.score,
        duplicateReasons: classification.reasons,
        classifiedAt: new Date(),
        ...(setsTargetCase
          ? { targetTestCaseId: classification.matchedCaseId }
          : {}),
      },
    });
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { buildJobId } from '../../common/queue/job-id';
import {
  PROPOSAL_CLASSIFICATION_QUEUE,
  RECLASSIFY_SUITE_JOB,
  type ReclassifySuiteJobData,
} from './proposal-classification.contracts';

@Injectable()
export class ProposalReclassifier {
  private readonly logger = new Logger(ProposalReclassifier.name);

  constructor(
    @InjectQueue(PROPOSAL_CLASSIFICATION_QUEUE)
    private readonly queue: Queue<ReclassifySuiteJobData>,
  ) {}

  async enqueue(suiteId: string | null): Promise<void> {
    if (suiteId === null) return;

    try {
      await this.queue.add(
        RECLASSIFY_SUITE_JOB,
        { suiteId },
        {
          deduplication: {
            id: buildJobId('reclassify', [suiteId]),
            keepLastIfActive: true,
          },
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue reclassify job for suite ${suiteId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

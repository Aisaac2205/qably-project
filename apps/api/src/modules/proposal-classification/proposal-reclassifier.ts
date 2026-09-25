import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { buildJobId } from '../../common/queue/job-id';
import {
  PROPOSAL_CLASSIFICATION_QUEUE,
  RECLASSIFY_SUITE_JOB,
  type ReclassifySuiteJobData,
} from './proposal-classification.contracts';

@Injectable()
export class ProposalReclassifier {
  constructor(
    @InjectQueue(PROPOSAL_CLASSIFICATION_QUEUE)
    private readonly queue: Queue<ReclassifySuiteJobData>,
  ) {}

  async enqueue(suiteId: string | null): Promise<void> {
    if (suiteId === null) return;

    await this.queue.add(
      RECLASSIFY_SUITE_JOB,
      { suiteId },
      { jobId: buildJobId('reclassify', [suiteId]) },
    );
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';
import { isErr } from '../../common/result';
import { ReportBatchService } from './report-batch.service';
import {
  REPORT_BATCH_TIMEOUT_JOB,
  RUN_INGEST_QUEUE,
  type ReportBatchTimeoutJobData,
  type RunIngestJobData,
  type RunQueueJobData,
} from './runs.contracts';
import { RunsService } from './runs.service';

@Processor(RUN_INGEST_QUEUE, { concurrency: 4 })
export class RunIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(RunIngestProcessor.name);

  constructor(
    private readonly runs: RunsService,
    private readonly reportBatch: ReportBatchService,
  ) {
    super();
  }

  async process(job: Job<RunQueueJobData>): Promise<void> {
    if (job.name === REPORT_BATCH_TIMEOUT_JOB) {
      await this.processBatchTimeout(job as Job<ReportBatchTimeoutJobData>);
      return;
    }

    await this.processIngest(job as Job<RunIngestJobData>);
  }

  private async processIngest(job: Job<RunIngestJobData>): Promise<void> {
    const { apiKey, body, reportSize } = job.data;
    const result = await this.runs.ingest(apiKey, body, reportSize);

    if (isErr(result)) {
      this.logger.warn(
        `run ingest rejected: project=${apiKey.projectId} externalId=${body.externalId} outcome=${result.error}`,
      );
      throw new UnrecoverableError(result.error);
    }

    this.logger.log(
      `run ingest succeeded: project=${apiKey.projectId} externalId=${body.externalId} outcome=accepted`,
    );
  }

  private async processBatchTimeout(
    job: Job<ReportBatchTimeoutJobData>,
  ): Promise<void> {
    await this.reportBatch.flushIfPending(job.data.key);
  }
}

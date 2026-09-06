import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';
import { isErr } from '../../common/result';
import { RUN_INGEST_QUEUE, type RunIngestJobData } from './runs.contracts';
import { RunsService } from './runs.service';

@Processor(RUN_INGEST_QUEUE, { concurrency: 4 })
export class RunIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(RunIngestProcessor.name);

  constructor(private readonly runs: RunsService) {
    super();
  }

  async process(job: Job<RunIngestJobData>): Promise<void> {
    const { apiKey, body } = job.data;
    const result = await this.runs.ingest(apiKey, body);

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
}

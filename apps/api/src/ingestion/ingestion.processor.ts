import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import type { ScmEventJob } from './ingestion.contracts';
import { INGESTION_QUEUE } from './ingestion.tokens';

@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ScmEventJob>): Promise<void> {
    const { scmEventId } = job.data;

    try {
      await this.prisma.scmEvent.update({
        where: { id: scmEventId },
        data: { status: 'PROCESSED' },
      });
    } catch (error) {
      this.logger.error(`Failed to process SCM event ${scmEventId}`);
      await this.prisma.scmEvent.update({
        where: { id: scmEventId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }
}

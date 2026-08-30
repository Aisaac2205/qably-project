import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  matchDeclaredTestPattern,
  type RepoConnectionProvider,
} from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { ScmEventJob } from './ingestion.contracts';
import { INGESTION_QUEUE } from './ingestion.tokens';

const BLOB_PATH: Record<
  RepoConnectionProvider,
  (repo: string, sha: string, filePath: string) => string
> = {
  GITHUB: (repo, sha, filePath) =>
    `https://github.com/${repo}/blob/${sha}/${filePath}`,
  BITBUCKET: (repo, sha, filePath) =>
    `https://bitbucket.org/${repo}/src/${sha}/${filePath}`,
};

interface PendingEvent {
  id: string;
  provider: RepoConnectionProvider;
  repo: string;
  commitSha: string;
  changedFiles: string[];
  connection: { projects: Array<{ id: string; testFilePatterns: string[] }> };
}

@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ScmEventJob>): Promise<void> {
    const { scmEventId } = job.data;

    try {
      const event = await this.pendingEvent(scmEventId);

      if (event !== null) await this.recordBatches(event);

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

  private async pendingEvent(scmEventId: string): Promise<PendingEvent | null> {
    return await this.prisma.scmEvent.findUnique({
      where: { id: scmEventId },
      select: {
        id: true,
        provider: true,
        repo: true,
        commitSha: true,
        changedFiles: true,
        connection: {
          select: {
            projects: { select: { id: true, testFilePatterns: true } },
          },
        },
      },
    });
  }

  private async recordBatches(event: PendingEvent): Promise<void> {
    if (event.changedFiles.length === 0) return;

    for (const project of event.connection.projects) {
      await this.prisma.ingestionBatch.create({
        data: {
          project: { connect: { id: project.id } },
          scmEvent: { connect: { id: event.id } },
          source: 'WEBHOOK',
          status: 'COMPLETED',
          codeChanges: {
            create: event.changedFiles.map((filePath) => ({
              project: { connect: { id: project.id } },
              commitSha: event.commitSha,
              filePath,
              detectedPattern:
                matchDeclaredTestPattern(filePath, project.testFilePatterns) ??
                null,
              evidence: {
                create: {
                  project: { connect: { id: project.id } },
                  kind: 'SOURCE_EXCERPT' as const,
                  title: filePath,
                  uri: BLOB_PATH[event.provider](
                    event.repo,
                    event.commitSha,
                    filePath,
                  ),
                },
              },
            })),
          },
        },
      });
    }
  }
}

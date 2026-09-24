import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DocumentationStateWrite } from './lib/publish-test-case-version';
import type { DocumentFileTarget } from './review.contracts';
import type { DocumentFileJobContext, JobContext } from './extraction.types';

const HUMAN_DOCUMENTATION_SOURCE = 'human';

@Injectable()
export class ExtractionFailureRecorder {
  private readonly logger = new Logger(ExtractionFailureRecorder.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordExtractionFailure(
    ctx: JobContext,
    reason: string,
  ): Promise<void> {
    if (ctx.targetTestCaseId === null) {
      this.logger.warn(
        `Extraction failed for ${ctx.filePath} with no target case, reason: ${reason}`,
      );
      return;
    }

    await this.markCasesFailed([ctx.targetTestCaseId], reason);
  }

  async recordExtractionFailureForTargets(
    ctx: DocumentFileJobContext,
    targets: readonly DocumentFileTarget[],
    reason: string,
  ): Promise<void> {
    if (targets.length === 0) return;

    await this.markCasesFailed(
      targets.map((target) => target.testCaseId),
      reason,
    );
  }

  private async markCasesFailed(
    testCaseIds: readonly string[],
    reason: string,
  ): Promise<void> {
    const failedState: DocumentationStateWrite = {
      documentationOutcome: 'failed',
      documentationSkipReason: reason,
      documentationOutcomeAt: new Date(),
      documentationQueuedAt: null,
    };

    await this.prisma.testCase.updateMany({
      where: {
        id: { in: [...testCaseIds] },
        documentationSource: { not: HUMAN_DOCUMENTATION_SOURCE },
        OR: [
          { documentationQueuedAt: { not: null } },
          { documentationOutcome: null },
          { documentationOutcome: 'failed' },
        ],
      },
      data: failedState,
    });
  }
}

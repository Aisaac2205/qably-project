import { Injectable, Logger } from '@nestjs/common';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import { PrismaService } from '../../prisma/prisma.service';
import { buildBlobUrl } from '../repository/source-reader';
import { isSourceUnavailableReason } from '../repository/lib/source-unavailable-reason';
import type { DocumentationStateWrite } from './lib/publish-test-case-version';
import type { DocumentFileTarget } from './review.contracts';
import type { DocumentFileJobContext, JobContext } from './extraction.types';

const MAX_FALLBACK_OBJECTIVE_LENGTH = 500;
const HUMAN_DOCUMENTATION_SOURCE = 'human';

@Injectable()
export class ExtractionFailureRecorder {
  private readonly logger = new Logger(ExtractionFailureRecorder.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordForTargets(
    ctx: DocumentFileJobContext,
    targets: readonly DocumentFileTarget[],
    reason: string,
    observations?: string[],
  ): Promise<void> {
    if (targets.length > 0) {
      const failedState: DocumentationStateWrite = {
        documentationOutcome: 'failed',
        documentationSkipReason: reason,
        documentationOutcomeAt: new Date(),
        documentationQueuedAt: null,
      };

      await this.prisma.testCase.updateMany({
        where: {
          id: { in: targets.map((target) => target.testCaseId) },
          documentationSource: { not: HUMAN_DOCUMENTATION_SOURCE },
          documentationQueuedAt: { not: null },
        },
        data: failedState,
      });
    }

    for (const target of targets) {
      await this.recordForJob(
        {
          projectId: ctx.projectId,
          organizationId: ctx.organizationId,
          filePath: ctx.filePath,
          ref: ctx.ref,
          connection: ctx.connection,
          codeChangeId: null,
          targetTestCaseId: target.testCaseId,
          knownSuiteId: null,
          onlyAutomationKey: target.automationKey,
          fallbackEvidenceId: null,
          locale: ctx.locale,
          isFinalAttempt: ctx.isFinalAttempt,
          isFirstAttempt: ctx.isFirstAttempt,
        },
        reason,
        observations,
      );
    }
  }

  async recordForJob(
    ctx: JobContext,
    reason: string,
    observations?: string[],
  ): Promise<void> {
    if (isSourceUnavailableReason(reason)) {
      if (ctx.targetTestCaseId !== null) {
        const failedState: DocumentationStateWrite = {
          documentationOutcome: 'failed',
          documentationSkipReason: reason,
          documentationOutcomeAt: new Date(),
          documentationQueuedAt: null,
        };

        await this.prisma.testCase.updateMany({
          where: {
            id: ctx.targetTestCaseId,
            documentationSource: { not: HUMAN_DOCUMENTATION_SOURCE },
            documentationQueuedAt: { not: null },
          },
          data: failedState,
        });
      }

      this.logger.log(
        `Skipping manual-review fallback for ${ctx.filePath}: source unavailable (${reason})`,
      );
      return;
    }

    const existing =
      ctx.codeChangeId !== null
        ? await this.prisma.extractedProposal.findFirst({
            where: { codeChangeId: ctx.codeChangeId, automationKey: null },
            select: { id: true },
          })
        : await this.prisma.extractedProposal.findFirst({
            where: {
              targetTestCaseId: ctx.targetTestCaseId,
              status: 'in_review',
            },
            select: { id: true },
          });

    if (existing !== null) {
      this.logger.log(
        `Manual-review fallback already pending for ${ctx.filePath}`,
      );
      return;
    }

    const evidenceId =
      ctx.fallbackEvidenceId ?? (await this.createFallbackEvidence(ctx));

    await this.prisma.extractedProposal.create({
      data: {
        projectId: ctx.projectId,
        evidenceId,
        codeChangeId: ctx.codeChangeId,
        targetTestCaseId: ctx.targetTestCaseId,
        status: 'in_review',
        title: ctx.filePath,
        objective: reason.slice(0, MAX_FALLBACK_OBJECTIVE_LENGTH),
        needsManualReview: true,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        locale: ctx.locale ?? null,
        ...(observations === undefined || observations.length === 0
          ? {}
          : { observations }),
      },
    });
  }

  private async createFallbackEvidence(ctx: JobContext): Promise<string> {
    const uri =
      ctx.connection === null
        ? ctx.filePath
        : buildBlobUrl(
            ctx.connection.provider,
            ctx.connection.repo,
            ctx.ref,
            ctx.filePath,
          );

    const evidence = await this.prisma.evidence.create({
      data: {
        projectId: ctx.projectId,
        kind: 'SOURCE_EXCERPT',
        title: ctx.filePath,
        uri,
      },
      select: { id: true },
    });

    return evidence.id;
  }
}

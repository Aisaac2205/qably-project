import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAutomationFilePath } from './lib/resolve-automation-file-path';
import {
  EXTRACTION_QUEUE,
  type DocumentCaseError,
  type ExtractionJobData,
} from './review.contracts';

const PENDING_STATUS = 'in_review';

interface CodeChangeCandidate {
  id: string;
  detectedPattern: string | null;
}

@Injectable()
export class ExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EXTRACTION_QUEUE)
    private readonly queue: Queue<ExtractionJobData>,
  ) {}

  async enqueueCodeChanges(
    codeChanges: CodeChangeCandidate[],
    organizationId: string,
  ): Promise<number> {
    const targets = codeChanges.filter(
      (change) => change.detectedPattern !== null,
    );

    if (targets.length === 0) return 0;

    const locale = await resolveOrgDefaultLocale(this.prisma, organizationId);

    await this.queue.addBulk(
      targets.map((change) => ({
        name: 'code-change',
        data: {
          kind: 'code-change' as const,
          codeChangeId: change.id,
          locale,
        },
        opts: { jobId: `code-change:${change.id}` },
      })),
    );

    return targets.length;
  }

  async enqueueDocumentCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
    actorLocale: string | null,
  ): Promise<Result<{ jobId: string }, DocumentCaseError>> {
    const testCase = await this.prisma.testCase.findFirst({
      where: {
        id: caseId,
        suiteId,
        suite: { organizationId: org.organizationId },
      },
      select: {
        id: true,
        projectId: true,
        executionMode: true,
        automationFilePath: true,
        automationKey: true,
      },
    });

    if (testCase === null) return err('not-found');
    if (testCase.executionMode !== 'automated') return err('not-automated');

    const pending = await this.prisma.extractedProposal.findFirst({
      where: { targetTestCaseId: caseId, status: PENDING_STATUS },
      select: { id: true },
    });

    if (pending !== null) return err('already-pending');

    const filePath =
      testCase.automationFilePath ??
      (await resolveAutomationFilePath(
        this.prisma,
        testCase.projectId,
        testCase.automationKey,
      ));

    if (filePath === null) return err('no-source-file');

    const locale =
      actorLocale === null
        ? await resolveOrgDefaultLocale(this.prisma, org.organizationId)
        : resolveLocale(actorLocale);

    const jobId = `document-case:${caseId}`;

    await this.queue.add(
      'document-case',
      { kind: 'document-case', testCaseId: caseId, locale },
      { jobId },
    );

    return ok({ jobId });
  }
}

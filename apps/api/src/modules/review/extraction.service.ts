import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import { MAX_EXTRACTED_CASES } from '../ai/extraction.contracts';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAutomationFilePath } from './lib/resolve-automation-file-path';
import {
  EXTRACTION_QUEUE,
  type DocumentCaseError,
  type DocumentFileTarget,
  type DocumentFilesError,
  type DocumentFilesMode,
  type DocumentFilesResult,
  type DocumentFilesSkip,
  type ExtractionJobData,
} from './review.contracts';

const PENDING_STATUS = 'in_review';

export const MAX_DOCUMENT_FILES_PER_REQUEST = 50;

export type DocumentFilesScope = { suiteId: string } | { projectId: string };

interface CodeChangeCandidate {
  id: string;
  detectedPattern: string | null;
}

interface DocumentFileCandidate {
  id: string;
  projectId: string;
  automationKey: string | null;
  automationFilePath: string | null;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildSkips(
  noSourceFile: number,
  alreadyPending: number,
): DocumentFilesSkip[] {
  const skips: DocumentFilesSkip[] = [];
  if (noSourceFile > 0) {
    skips.push({ reason: 'no-source-file', count: noSourceFile });
  }
  if (alreadyPending > 0) {
    skips.push({ reason: 'already-pending', count: alreadyPending });
  }
  return skips;
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

  async enqueueDocumentFiles(
    org: OrgContext,
    scope: DocumentFilesScope,
    actorLocale: string | null,
    mode: DocumentFilesMode = 'undocumented',
  ): Promise<Result<DocumentFilesResult, DocumentFilesError>> {
    const scopeIsValid = await this.scopeExists(org, scope);
    if (!scopeIsValid) return err('not-found');

    const scopeWhere =
      'suiteId' in scope
        ? { suiteId: scope.suiteId }
        : { projectId: scope.projectId };

    const orgLocale =
      mode === 'stale-locale'
        ? await resolveOrgDefaultLocale(this.prisma, org.organizationId)
        : null;

    const candidateWhere =
      mode === 'undocumented'
        ? { steps: { equals: [] } }
        : {
            NOT: { steps: { equals: [] } },
            OR: [
              { currentVersion: null },
              { currentVersion: { locale: null } },
              { currentVersion: { locale: { not: orgLocale as string } } },
            ],
          };

    const candidates = (await this.prisma.testCase.findMany({
      where: {
        ...scopeWhere,
        executionMode: 'automated',
        ...candidateWhere,
      },
      select: {
        id: true,
        projectId: true,
        automationKey: true,
        automationFilePath: true,
      },
    })) as DocumentFileCandidate[];

    if (candidates.length === 0) {
      return ok({ filesEnqueued: 0, casesTargeted: 0, casesSkipped: [] });
    }

    const pendingRows = await this.prisma.extractedProposal.findMany({
      where: {
        targetTestCaseId: { in: candidates.map((candidate) => candidate.id) },
        status: PENDING_STATUS,
      },
      select: { targetTestCaseId: true },
    });
    const pendingIds = new Set(
      pendingRows
        .map((row) => row.targetTestCaseId)
        .filter((id): id is string => id !== null),
    );

    let alreadyPending = 0;
    let noSourceFile = 0;
    const groupedByFile = new Map<string, DocumentFileTarget[]>();

    for (const candidate of candidates) {
      if (pendingIds.has(candidate.id)) {
        alreadyPending += 1;
        continue;
      }

      if (candidate.automationKey === null) {
        noSourceFile += 1;
        continue;
      }

      const filePath =
        candidate.automationFilePath ??
        (await resolveAutomationFilePath(
          this.prisma,
          candidate.projectId,
          candidate.automationKey,
        ));

      if (filePath === null) {
        noSourceFile += 1;
        continue;
      }

      const group = groupedByFile.get(filePath) ?? [];
      group.push({
        testCaseId: candidate.id,
        automationKey: candidate.automationKey,
      });
      groupedByFile.set(filePath, group);
    }

    const casesSkipped = buildSkips(noSourceFile, alreadyPending);

    if (groupedByFile.size === 0) {
      return ok({ filesEnqueued: 0, casesTargeted: 0, casesSkipped });
    }

    const locale =
      actorLocale === null
        ? await resolveOrgDefaultLocale(this.prisma, org.organizationId)
        : resolveLocale(actorLocale);

    const projectId = candidates[0].projectId;
    const files = [...groupedByFile.entries()].slice(
      0,
      MAX_DOCUMENT_FILES_PER_REQUEST,
    );

    let casesTargeted = 0;
    const jobs: {
      name: string;
      data: ExtractionJobData;
      opts: { jobId: string };
    }[] = [];

    for (const [filePath, targets] of files) {
      chunk(targets, MAX_EXTRACTED_CASES).forEach((chunkTargets, index) => {
        casesTargeted += chunkTargets.length;
        jobs.push({
          name: 'document-file',
          data: {
            kind: 'document-file',
            filePath,
            targets: chunkTargets,
            locale,
          },
          opts: { jobId: `document-file:${projectId}:${filePath}:${index}` },
        });
      });
    }

    await this.queue.addBulk(jobs);

    return ok({
      filesEnqueued: files.length,
      casesTargeted,
      casesSkipped,
    });
  }

  private async scopeExists(
    org: OrgContext,
    scope: DocumentFilesScope,
  ): Promise<boolean> {
    if ('suiteId' in scope) {
      const suite = await this.prisma.suite.findFirst({
        where: { id: scope.suiteId, organizationId: org.organizationId },
        select: { id: true },
      });
      return suite !== null;
    }

    const project = await this.prisma.project.findFirst({
      where: { id: scope.projectId, organizationId: org.organizationId },
      select: { id: true },
    });
    return project !== null;
  }
}
